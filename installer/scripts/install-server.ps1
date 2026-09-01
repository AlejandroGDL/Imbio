# =================================================================
# install-server.ps1
# =================================================================
# Configura esta PC como SERVIDOR de IMBIO. Se ejecuta automáticamente
# desde el instalador NSIS cuando el usuario elige "Servidor".
#
# Qué hace:
#   1. Genera .env con secretos aleatorios (JWT_SECRET, password de Postgres)
#   2. Inicializa el cluster de PostgreSQL (initdb)
#   3. Inicia PostgreSQL como servicio de Windows (con nssm)
#   4. Crea el rol `imbio` y la base de datos `imbio`
#   5. Corre las migraciones de Prisma
#   6. (Opcional) Corre el seed inicial
#   7. Registra el server de IMBIO como servicio de Windows (con nssm)
#   8. Inicia el servicio del server
#   9. Guarda config.json con {serverUrl: localhost, mode: server}
#
# Parámetros:
#   -InstallDir     Carpeta donde el instalador puso los archivos
#                   (default: C:\Program Files\IMBIO)
#   -ServerPort     Puerto del server IMBIO (default: 3000)
#   -PostgresPort   Puerto de PostgreSQL (default: 5432)
#   -RunSeed        Si se debe correr el seed inicial (default: $true)
#   -SkipFirewall   Si se debe omitir la regla de firewall (default: $false)
# =================================================================

[CmdletBinding()]
param(
    [string]$InstallDir,
    [int]$ServerPort = 3000,
    [int]$PostgresPort = 5432,
    [bool]$RunSeed = $true,
    [bool]$SkipFirewall = $false
)

# Importar funciones comunes
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptPath "common.ps1")

# --- Verificar administrador ---
if (-not (Test-Administrator)) {
    Write-Err "Este script debe ejecutarse como Administrador."
    Write-Host "Clic derecho → 'Ejecutar con PowerShell como administrador'"
    Pause-And-Exit 1
}

# --- Validar InstallDir ---
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = $Script:DefaultInstallDir
}
if (-not (Test-Path $InstallDir)) {
    Write-Err "No se encontró el directorio de instalación: $InstallDir"
    Pause-And-Exit 1
}

# Carpetas internas
$Script:NodeBinDir     = Join-Path $InstallDir "node"
$Script:PostgresBinDir = Join-Path $InstallDir "pgsql"
$Script:ServerDir      = Join-Path $InstallDir "server"
$nodeExe               = Join-Path $Script:NodeBinDir "node.exe"
$pgCtl                 = Join-Path $Script:PostgresBinDir "bin\pg_ctl.exe"
$pgInitdb              = Join-Path $Script:PostgresBinDir "bin\initdb.exe"
$psql                  = Join-Path $Script:PostgresBinDir "bin\psql.exe"
$nssmExe               = Join-Path $InstallDir "nssm.exe"
$serverEntry           = Join-Path $Script:ServerDir "dist\index.js"

# --- Validar prerrequisitos ---
Write-Step "Validando prerrequisitos..."
$prereqs = @{
    "Node.js portable"       = $nodeExe
    "PostgreSQL binarios"    = $pgCtl
    "Server bundle"          = $serverEntry
    "nssm.exe"               = $nssmExe
}
$missing = $prereqs.Keys | Where-Object { -not (Test-Path $prereqs[$_]) }
if ($missing.Count -gt 0) {
    Write-Err "Faltan archivos del instalador:"
    foreach ($m in $missing) { Write-Host "    - $m ($($prereqs[$m]))" }
    Write-Host ""
    Write-Host "  Posibles causas:" -ForegroundColor Yellow
    Write-Host "  1. El bundle del server no se descomprimió" -ForegroundColor Gray
    Write-Host "  2. La descarga de Node/PostgreSQL/nssm falló" -ForegroundColor Gray
    Write-Host "  3. Antivirus bloqueó algunos archivos" -ForegroundColor Gray
    Write-Host ""
    Pause-And-Exit 1
}
Write-Ok "Todos los archivos del instalador están presentes"

Initialize-IMBIODirectories
Write-Log "Iniciando instalación del server en $InstallDir"

# --- 1. Generar secretos aleatorios ---
Write-Step "Generando secretos aleatorios..."
$jwtSecret   = New-RandomSecret -Length 64
$dbPassword  = New-RandomPassword -Length 24
$dbUser      = "imbio"
$dbName      = "imbio"
Write-Ok "JWT_SECRET generado (64 chars)"
Write-Ok "Password de PostgreSQL generado (24 chars)"

# --- 2. Generar .env del server ---
Write-Step "Generando .env del servidor..."
$envContent = @"
# Generado automáticamente por el instalador de IMBIO
# NO editar a mano — usar la página de Configuración de la app

# Servidor
NODE_ENV=production
PORT=$ServerPort
HOST=0.0.0.0
LOG_LEVEL=info

# Base de datos (PostgreSQL local)
DATABASE_URL=postgresql://${dbUser}:${dbPassword}@127.0.0.1:${PostgresPort}/${dbName}?schema=public

# Autenticación
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=8h

# CORS (cliente LAN)
CORS_ORIGINS=*

# Seed automático
AUTO_SEED=true
"@
$envFile = Join-Path $Script:ServerDir ".env"
Set-Content -Path $envFile -Value $envContent -Encoding UTF8
Write-Ok ".env escrito en: $envFile"

# --- 3. Inicializar cluster de PostgreSQL ---
if (-not (Test-Path (Join-Path $Script:PostgresDataDir "PG_VERSION"))) {
    Write-Step "Inicializando cluster de PostgreSQL (initdb)..."
    $initdbArgs = @(
        "-D", "`"$Script:PostgresDataDir`""
        "-U", $dbUser
        "--auth=md5"
        "--encoding=UTF8"
        "--locale=C"
        "-E", "UTF8"
    )
    & $pgInitdb @initdbArgs 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "initdb falló"
        Pause-And-Exit 1
    }
    Write-Ok "Cluster inicializado en: $Script:PostgresDataDir"

    # Configurar listen_addresses y puerto
    $pgConf = Join-Path $Script:PostgresDataDir "postgresql.conf"
    if (Test-Path $pgConf) {
        Add-Content -Path $pgConf -Value @"

# IMBIO installer config
listen_addresses = '127.0.0.1'
port = $PostgresPort
unix_socket_directories = '$Script:PostgresDataDir'
"@
    }

    # pg_hba.conf para permitir conexiones locales con password
    $pgHba = Join-Path $Script:PostgresDataDir "pg_hba.conf"
    if (Test-Path $pgHba) {
        Add-Content -Path $pgHba -Value @"

# IMBIO installer rules
host    all    all    127.0.0.1/32    md5
"@
    }
} else {
    Write-Warn "Cluster de PostgreSQL ya existe, saltando initdb"
}

# --- 4. Registrar PostgreSQL como servicio de Windows ---
Write-Step "Registrando PostgreSQL como servicio de Windows..."
$pgServiceName = "ImbioPostgreSQL"
if (Test-ServiceExists $pgServiceName) {
    Write-Warn "Servicio '$pgServiceName' ya existe, saltando registro"
} else {
    & $nssmExe install $pgServiceName $pgCtl @(
        "start"
        "-D", "`"$Script:PostgresDataDir`""
        "-l", "`"$Script:LogsDir\postgresql.log`""
        "-w"
    ) 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "No se pudo registrar el servicio de PostgreSQL con nssm"
        Pause-And-Exit 1
    }
    # Configurar tipo de servicio
    & $nssmExe set $pgServiceName AppDirectory $Script:PostgresDataDir 2>&1 | Out-Null
    & $nssmExe set $pgServiceName DisplayName "IMBIO PostgreSQL" 2>&1 | Out-Null
    & $nssmExe set $pgServiceName Description "PostgreSQL local para IMBIO" 2>&1 | Out-Null
    & $nssmExe set $pgServiceName Start SERVICE_AUTO_START 2>&1 | Out-Null
    Write-Ok "Servicio '$pgServiceName' registrado"
}

# --- 5. Iniciar PostgreSQL ---
Write-Step "Iniciando PostgreSQL..."
$pgSvc = Get-Service -Name $pgServiceName -ErrorAction SilentlyContinue
if ($pgSvc.Status -ne "Running") {
    Start-Service -Name $pgServiceName
    Start-Sleep -Seconds 2
}
if (-not (Wait-PortOpen -Port $PostgresPort -TimeoutSeconds 15)) {
    Write-Err "PostgreSQL no respondió en puerto $PostgresPort"
    Write-Host "    Revisa el log: $Script:LogsDir\postgresql.log"
    Pause-And-Exit 1
}
Write-Ok "PostgreSQL corriendo en puerto $PostgresPort"

# --- 6. Crear rol y base de datos ---
Write-Step "Creando rol '$dbUser' y base de datos '$dbName'..."
# Configurar password del rol
$roleSql = "ALTER USER $dbUser WITH PASSWORD '$dbPassword' SUPERUSER;"
$env:PGPASSWORD = ""
# El rol ya existe (initdb lo creó con -U), solo le seteamos el password
& $psql -h 127.0.0.1 -p $PostgresPort -U $dbUser -d postgres -c $roleSql 2>&1 | Out-Null

# Crear la base de datos (si no existe)
$dbCheck = & $psql -h 127.0.0.1 -p $PostgresPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'" 2>&1
if ($dbCheck -ne "1") {
    & $psql -h 127.0.0.1 -p $PostgresPort -U $dbUser -d postgres -c "CREATE DATABASE $dbName OWNER $dbUser" 2>&1 | Out-Null
    Write-Ok "Base de datos '$dbName' creada"
} else {
    Write-Warn "Base de datos '$dbName' ya existe"
}
$env:PGPASSWORD = $dbPassword
# Verificar que nos podemos conectar con password
$test = & $psql -h 127.0.0.1 -p $PostgresPort -U $dbUser -d $dbName -c "SELECT 1" 2>&1
$env:PGPASSWORD = ""
if ($LASTEXITCODE -ne 0) {
    Write-Err "No se pudo conectar a PostgreSQL con el password configurado"
    Write-Host $test
    Pause-And-Exit 1
}
Write-Ok "Conexión a PostgreSQL verificada"

# --- 7. Correr migraciones de Prisma ---
Write-Step "Aplicando migraciones de Prisma..."
$prismaBin = Join-Path $Script:ServerDir "node_modules\.bin\prisma.ps1"
if (-not (Test-Path $prismaBin)) {
    $prismaBin = Join-Path $Script:ServerDir "node_modules\.bin\prisma.cmd"
}
if (-not (Test-Path $prismaBin)) {
    Write-Err "No se encontró Prisma en el bundle del server"
    Pause-And-Exit 1
}
Push-Location $Script:ServerDir
try {
    & $prismaBin migrate deploy 2>&1 | Tee-Object -Variable prismaOut | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Las migraciones de Prisma fallaron"
        Pause-And-Exit 1
    }
    Write-Ok "Migraciones aplicadas"
} finally {
    Pop-Location
}

# --- 8. (Opcional) Correr seed inicial ---
if ($RunSeed) {
    Write-Step "Ejecutando seed inicial..."
    Push-Location $Script:ServerDir
    try {
        & $nodeExe "--env-file=.env" "node_modules\.bin\tsx" "prisma\seed.ts" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "El seed falló (no crítico), continuando..."
        } else {
            Write-Ok "Seed ejecutado"
        }
    } catch {
        Write-Warn "No se pudo ejecutar el seed (puede que no haya archivo seed.ts)"
    } finally {
        Pop-Location
    }
}

# --- 9. Registrar el server IMBIO como servicio de Windows ---
Write-Step "Registrando IMBIO Server como servicio de Windows..."
$serverServiceName = "ImbioServer"
if (Test-ServiceExists $serverServiceName) {
    Write-Warn "Servicio '$serverServiceName' ya existe, saltando registro"
} else {
    & $nssmExe install $serverServiceName $nodeExe @(
        "`"$serverEntry`""
    ) 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "No se pudo registrar el servicio del server"
        Pause-And-Exit 1
    }
    & $nssmExe set $serverServiceName AppDirectory $Script:ServerDir 2>&1 | Out-Null
    & $nssmExe set $serverServiceName AppEnvironmentExtra "PATH=$Script:NodeBinDir;$Script:PostgresBinDir\bin" 2>&1 | Out-Null
    & $nssmExe set $serverServiceName DisplayName "IMBIO Server" 2>&1 | Out-Null
    & $nssmExe set $serverServiceName Description "Servidor backend de IMBIO" 2>&1 | Out-Null
    & $nssmExe set $serverServiceName Start SERVICE_AUTO_START 2>&1 | Out-Null
    & $nssmExe set $serverServiceName AppStdout "$Script:LogsDir\server.log" 2>&1 | Out-Null
    & $nssmExe set $serverServiceName AppStderr "$Script:LogsDir\server-error.log" 2>&1 | Out-Null
    & $nssmExe set $serverServiceName AppRotateFiles 1 2>&1 | Out-Null
    & $nssmExe set $serverServiceName AppRotateBytes 10485760 2>&1 | Out-Null  # 10MB
    Write-Ok "Servicio '$serverServiceName' registrado"
}

# Dependencia: el server depende de PostgreSQL
& $nssmExe set $serverServiceName DependOnService $pgServiceName 2>&1 | Out-Null

# --- 10. Iniciar el server ---
Write-Step "Iniciando IMBIO Server..."
Start-Service -Name $serverServiceName
if (-not (Wait-PortOpen -Port $ServerPort -TimeoutSeconds 30)) {
    Write-Err "El server no respondió en puerto $ServerPort"
    Write-Host "    Revisa el log: $Script:LogsDir\server.log"
    Pause-And-Exit 1
}
Write-Ok "IMBIO Server corriendo en puerto $ServerPort"

# --- 11. Regla de firewall (opcional) ---
if (-not $SkipFirewall) {
    Write-Step "Configurando firewall de Windows..."
    $ruleName = "IMBIO Server (puerto $ServerPort)"
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Warn "Regla de firewall '$ruleName' ya existe"
    } else {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $ServerPort -Action Allow -Profile Any 2>&1 | Out-Null
        Write-Ok "Firewall abierto para puerto $ServerPort"
    }
}

# --- 12. Guardar config.json para la app Tauri ---
Write-Step "Configurando acceso directo desde la app IMBIO..."
$serverUrl = "http://localhost:$ServerPort"
Write-IMBIOConfig -ServerUrl $serverUrl -Mode "server"

# --- 13. Crear acceso directo en escritorio ---
Write-Step "Creando acceso directo 'IMBIO Server Manager'..."
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "IMBIO Server Manager.lnk"
$wsShell = New-Object -ComObject WScript.Shell
$wsShell.CreateShortcut($shortcutPath).TargetPath = "powershell.exe"
$shortcut = $wsShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoExit -Command `"Get-Service ImbioServer,ImbioPostgreSQL | Format-Table -AutoSize; Write-Host ''; Write-Host 'Para reiniciar: Restart-Service ImbioServer' -ForegroundColor Cyan; Write-Host 'Para ver logs: notepad C:\ProgramData\IMBIO\logs\server.log' -ForegroundColor Cyan`""
$shortcut.WorkingDirectory = $InstallDir
$shortcut.IconLocation = "powershell.exe,0"
$shortcut.Description = "Administrar IMBIO Server"
$shortcut.Save()
Write-Ok "Acceso directo creado en escritorio"

# --- 14. Resumen ---
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ IMBIO Server instalado correctamente" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  URL del servidor:  $serverUrl" -ForegroundColor White
Write-Host "  PostgreSQL:        127.0.0.1:$PostgresPort (db: $dbName, user: $dbUser)" -ForegroundColor White
Write-Host "  Datos:             $Script:ProgramDataDir" -ForegroundColor White
Write-Host "  Logs:              $Script:LogsDir" -ForegroundColor White
Write-Host ""
Write-Host "  Servicios de Windows:" -ForegroundColor White
Write-Host "    - ImbioPostgreSQL (auto-arranque)" -ForegroundColor Gray
Write-Host "    - ImbioServer     (auto-arranque, depende de PostgreSQL)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Comandos útiles:" -ForegroundColor White
Write-Host "    Get-Service ImbioServer                       Ver estado" -ForegroundColor Gray
Write-Host "    Restart-Service ImbioServer                   Reiniciar server" -ForegroundColor Gray
Write-Host "    Restart-Service ImbioPostgreSQL              Reiniciar PostgreSQL" -ForegroundColor Gray
Write-Host "    notepad C:\ProgramData\IMBIO\logs\server.log Ver logs" -ForegroundColor Gray
Write-Host ""
Write-Host "  Otros PCs en la LAN deben conectarse a:" -ForegroundColor White
$lanIps = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias (Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1).Name -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" }
foreach ($ip in $lanIps) {
    Write-Host "    http://$($ip.IPAddress):$ServerPort" -ForegroundColor Cyan
}
Write-Host ""

Write-Log "Instalación del server completada exitosamente"
