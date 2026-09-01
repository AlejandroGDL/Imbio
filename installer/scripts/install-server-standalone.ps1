# =================================================================
# install-server-standalone.ps1
# =================================================================
# Instalador MANUAL del servidor IMBIO. NO depende de Tauri/NSIS.
# Tú lo corres desde PowerShell como Administrador después de
# instalar la app desde el .msi/.exe.
#
# Uso:
#   1. Abrir PowerShell como Administrador
#   2. cd "C:\Program Files\IMBIO\resources"
#   3. .\install-server-standalone.ps1
#
# Qué hace:
#   1. Verifica que eres admin
#   2. Descarga Node.js portable si no está
#   3. Descarga PostgreSQL binaries si no está
#   4. Descarga nssm si no está
#   5. Inicializa el cluster de PostgreSQL
#   6. Crea la DB "imbio" con un password aleatorio
#   7. Genera .env con JWT_SECRET aleatorio
#   8. Corre las migraciones de Prisma
#   9. Registra PostgreSQL y el server como servicios de Windows
#   10. Crea acceso directo "IMBIO Server Manager" en el escritorio
# =================================================================

[CmdletBinding()]
param(
    [string]$InstallDir,
    [int]$ServerPort = 3000,
    [int]$PostgresPort = 5432,
    [bool]$RunSeed = $true
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "IMBIO Server Setup"

# Configurar consola con colores
function Write-Step { param($m) Write-Host ""; Write-Host "▶ $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "  ✓ $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "  ⚠ $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "  ✗ $m" -ForegroundColor Red }

# --- Verificar admin ---
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMBIO Server Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Err "Este script DEBE ejecutarse como Administrador."
    Write-Host "Clic derecho en PowerShell → 'Ejecutar como administrador'" -ForegroundColor Yellow
    exit 1
}
Write-Ok "Ejecutando como administrador"

# --- Detectar InstallDir ---
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    # Asumir que estamos en C:\Program Files\IMBIO\resources
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    if ($scriptDir -like "*\resources") {
        $InstallDir = Split-Path -Parent $scriptDir
    } else {
        $InstallDir = "C:\Program Files\IMBIO"
    }
}
Write-Host "  InstallDir: $InstallDir" -ForegroundColor Gray

$nodeBin   = Join-Path $InstallDir "node"
$pgBin     = Join-Path $InstallDir "pgsql"
$nssm      = Join-Path $InstallDir "nssm.exe"
$serverDir = Join-Path $InstallDir "server"
$progData  = Join-Path $env:ProgramData "IMBIO"

# Crear carpetas
New-Item -Path $progData -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $progData "logs") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $progData "data\postgresql") -ItemType Directory -Force | Out-Null

# Log a archivo
$logFile = Join-Path $progData "logs\setup.log"
function Write-Log {
    param($m, $level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$ts] [$level] $m"
}

Write-Log "Setup iniciado. InstallDir=$InstallDir"

# --- 1. Verificar / descargar binarios ---
function Download-File {
    param([string]$Url, [string]$Dest, [int]$MinSizeMB = 10)
    if (Test-Path $Dest) {
        $size = (Get-Item $Dest).Length
        if ($size -gt ($MinSizeMB * 1MB)) {
            Write-Ok "Ya existe: $Dest ($([math]::Round($size/1MB, 1)) MB)"
            return
        }
    }
    Write-Host "  Descargando $Url ..." -ForegroundColor Gray
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing -TimeoutSec 600
        $size = (Get-Item $Dest).Length
        Write-Ok "Descargado: $Dest ($([math]::Round($size/1MB, 1)) MB)"
        Write-Log "Descargado $Url"
    } catch {
        Write-Err "Fallo al descargar $Url"
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

function Expand-Zip {
    param([string]$Zip, [string]$Dest)
    if (Test-Path $Dest) { Remove-Item -Path $Dest -Recurse -Force }
    New-Item -Path $Dest -ItemType Directory -Force | Out-Null
    Expand-Archive -Path $Zip -DestinationPath $Dest -Force
}

Write-Step "Paso 1/6: Verificando binarios externos"

# Node.js
if (-not (Test-Path "$nodeBin\node.exe")) {
    Write-Host "  Descargando Node.js portable v22.11.0 (~30 MB)..." -ForegroundColor Yellow
    $nodeZip = Join-Path $env:TEMP "node.zip"
    Download-File -Url "https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip" -Dest $nodeZip -MinSizeMB 20
    Expand-Zip -Zip $nodeZip -Dest (Join-Path $env:TEMP "node-extract")
    # El zip tiene subdirectorio "node-v22.11.0-win-x64/"
    $nodeSubdir = Get-ChildItem -Path (Join-Path $env:TEMP "node-extract") -Directory | Select-Object -First 1
    if ($null -eq $nodeSubdir) { throw "Estructura inesperada en zip de Node" }
    if (Test-Path $nodeBin) { Remove-Item -Path $nodeBin -Recurse -Force }
    Move-Item -Path $nodeSubdir.FullName -Destination $nodeBin
    Remove-Item -Path (Join-Path $env:TEMP "node-extract") -Recurse -Force
    Remove-Item -Path $nodeZip -Force
    Write-Ok "Node.js instalado en $nodeBin"
} else {
    Write-Ok "Node.js ya está instalado"
}

# PostgreSQL
$pgCtl = Join-Path $pgBin "bin\pg_ctl.exe"
if (-not (Test-Path $pgCtl)) {
    Write-Host "  Descargando PostgreSQL 16.4 binaries (~80 MB)..." -ForegroundColor Yellow
    $pgZip = Join-Path $env:TEMP "postgres.zip"
    Download-File -Url "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip" -Dest $pgZip -MinSizeMB 70
    Expand-Zip -Zip $pgZip -Dest (Join-Path $env:TEMP "pg-extract")
    $pgSubdir = Join-Path $env:TEMP "pg-extract\pgsql"
    if (-not (Test-Path $pgSubdir)) {
        $pgSubdir = Get-ChildItem -Path (Join-Path $env:TEMP "pg-extract") -Directory | Select-Object -First 1
    }
    if ($null -eq $pgSubdir) { throw "Estructura inesperada en zip de PostgreSQL" }
    if (Test-Path $pgBin) { Remove-Item -Path $pgBin -Recurse -Force }
    Move-Item -Path $pgSubdir.FullName -Destination $pgBin
    Remove-Item -Path (Join-Path $env:TEMP "pg-extract") -Recurse -Force
    Remove-Item -Path $pgZip -Force
    Write-Ok "PostgreSQL instalado en $pgBin"
} else {
    Write-Ok "PostgreSQL ya está instalado"
}

# nssm
if (-not (Test-Path $nssm)) {
    Write-Host "  Descargando nssm 2.24 (~1 MB)..." -ForegroundColor Yellow
    $nssmZip = Join-Path $env:TEMP "nssm.zip"
    Download-File -Url "https://nssm.cc/release/nssm-2.24.zip" -Dest $nssmZip -MinSizeMB 0.5
    Expand-Zip -Zip $nssmZip -Dest (Join-Path $env:TEMP "nssm-extract")
    $nssmExeSrc = Get-ChildItem -Path (Join-Path $env:TEMP "nssm-extract") -Recurse -Filter "nssm.exe" |
                  Where-Object { $_.DirectoryName -like "*win64*" } | Select-Object -First 1
    if ($null -eq $nssmExeSrc) { throw "No se encontró nssm.exe win64" }
    Copy-Item -Path $nssmExeSrc.FullName -Destination $nssm -Force
    Remove-Item -Path (Join-Path $env:TEMP "nssm-extract") -Recurse -Force
    Remove-Item -Path $nssmZip -Force
    Write-Ok "nssm instalado en $nssm"
} else {
    Write-Ok "nssm ya está instalado"
}

# --- 2. Generar secretos ---
Write-Step "Paso 2/6: Generando secretos"
$jwtSecret = -join ((1..48) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
$dbPassword = -join ((1..24) | ForEach-Object {
    $c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $c[(Get-Random -Maximum $c.Length)]
})
Write-Ok "JWT_SECRET generado (48 chars)"
Write-Ok "Password de PostgreSQL generado (24 chars)"
Write-Log "Secretos generados"

# --- 3. Generar .env ---
Write-Step "Paso 3/6: Generando .env del servidor"
$envContent = @"
NODE_ENV=production
PORT=$ServerPort
HOST=0.0.0.0
LOG_LEVEL=info
DATABASE_URL=postgresql://imbio:${dbPassword}@127.0.0.1:${PostgresPort}/imbio?schema=public
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=8h
CORS_ORIGINS=*
AUTO_SEED=true
"@
$envFile = Join-Path $serverDir ".env"
Set-Content -Path $envFile -Value $envContent -Encoding UTF8
Write-Ok ".env escrito en: $envFile"

# --- 4. Inicializar PostgreSQL ---
Write-Step "Paso 4/6: Inicializando PostgreSQL"
$pgData = Join-Path $progData "data\postgresql"
$pgInitdb = Join-Path $pgBin "bin\initdb.exe"

if (-not (Test-Path (Join-Path $pgData "PG_VERSION"))) {
    Write-Host "  Corriendo initdb (puede tardar 1-2 min)..." -ForegroundColor Yellow
    $initdbArgs = @("-D", "`"$pgData`"", "-U", "imbio", "--auth=md5", "--encoding=UTF8", "--locale=C", "-E", "UTF8")
    $p = Start-Process -FilePath $pgInitdb -ArgumentList $initdbArgs -NoNewWindow -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "initdb falló con código $($p.ExitCode)" }

    # Configurar listen_addresses y puerto
    $pgConf = Join-Path $pgData "postgresql.conf"
    Add-Content -Path $pgConf -Value @"

# IMBIO installer config
listen_addresses = '127.0.0.1'
port = $PostgresPort
unix_socket_directories = '$pgData'
"@
    $pgHba = Join-Path $pgData "pg_hba.conf"
    Add-Content -Path $pgHba -Value @"

host    all    all    127.0.0.1/32    md5
"@
    Write-Ok "Cluster inicializado"
} else {
    Write-Ok "Cluster ya existe"
}

# --- 5. Registrar e iniciar servicios ---
Write-Step "Paso 5/6: Registrando servicios de Windows"

$pgService = "ImbioPostgreSQL"
$serverService = "ImbioServer"

# Registrar PostgreSQL
$pgSvc = Get-Service -Name $pgService -ErrorAction SilentlyContinue
if (-not $pgSvc) {
    Write-Host "  Registrando PostgreSQL como servicio..." -ForegroundColor Yellow
    & $nssm install $pgService (Join-Path $pgBin "bin\pg_ctl.exe") @("start", "-D", "`"$pgData`"", "-l", "`"$progData\logs\postgresql.log`"", "-w") 2>&1 | Out-Null
    & $nssm set $pgService AppDirectory $pgData 2>&1 | Out-Null
    & $nssm set $pgService DisplayName "IMBIO PostgreSQL" 2>&1 | Out-Null
    & $nssm set $pgService Description "PostgreSQL local para IMBIO" 2>&1 | Out-Null
    & $nssm set $pgService Start SERVICE_AUTO_START 2>&1 | Out-Null
    Write-Ok "Servicio $pgService registrado"
} else {
    Write-Ok "Servicio $pgService ya existe"
}

# Iniciar PostgreSQL
Write-Host "  Iniciando PostgreSQL..." -ForegroundColor Yellow
$pgSvc = Get-Service -Name $pgService
if ($pgSvc.Status -ne "Running") {
    Start-Service -Name $pgService
    Start-Sleep -Seconds 3
}
# Esperar al puerto
$deadline = (Get-Date).AddSeconds(30)
$pgReady = $false
while ((Get-Date) -lt $deadline) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.BeginConnect("127.0.0.1", $PostgresPort, $null, $null) | Out-Null
        Start-Sleep -Milliseconds 200
        if ($tcp.Connected) { $pgReady = $true; $tcp.Close(); break }
        $tcp.Close()
    } catch { }
    Start-Sleep -Milliseconds 500
}
if (-not $pgReady) { throw "PostgreSQL no arrancó en puerto $PostgresPort" }
Write-Ok "PostgreSQL corriendo en puerto $PostgresPort"

# --- 6. Crear DB y migrar ---
Write-Step "Paso 6/6: Configurando base de datos"

# Setear password del rol
$psql = Join-Path $pgBin "bin\psql.exe"
$env:PGPASSWORD = ""
& $psql -h 127.0.0.1 -p $PostgresPort -U imbio -d postgres -c "ALTER USER imbio WITH PASSWORD '$dbPassword' SUPERUSER;" 2>&1 | Out-Null

# Verificar que se puede conectar con password
$env:PGPASSWORD = $dbPassword
$test = & $psql -h 127.0.0.1 -p $PostgresPort -U imbio -d imbio -c "SELECT 1" 2>&1
$env:PGPASSWORD = ""
if ($LASTEXITCODE -ne 0) { throw "Conexion con password fallo: $test" }
Write-Ok "Conexion con password verificada"

# Crear DB si no existe
$env:PGPASSWORD = $dbPassword
$dbExists = & $psql -h 127.0.0.1 -p $PostgresPort -U imbio -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='imbio'" 2>&1
if ($dbExists -ne "1") {
    & $psql -h 127.0.0.1 -p $PostgresPort -U imbio -d postgres -c "CREATE DATABASE imbio OWNER imbio" 2>&1 | Out-Null
    Write-Ok "DB 'imbio' creada"
} else {
    Write-Ok "DB 'imbio' ya existe"
}
$env:PGPASSWORD = ""

# Correr migraciones de Prisma
Write-Host "  Corriendo migraciones de Prisma..." -ForegroundColor Yellow
$prisma = Join-Path $serverDir "node_modules\.bin\prisma.cmd"
if (-not (Test-Path $prisma)) { throw "No se encontro prisma en $prisma" }
Push-Location $serverDir
try {
    & $prisma migrate deploy 2>&1 | Tee-Object -Variable migrateOut | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Prisma migrate fallo" }
    Write-Ok "Migraciones aplicadas"
} finally { Pop-Location }

# Seed (opcional)
if ($RunSeed) {
    $seed = Join-Path $serverDir "prisma\seed.ts"
    if (Test-Path $seed) {
        Write-Host "  Corriendo seed..." -ForegroundColor Yellow
        Push-Location $serverDir
        try {
            $nodeExe = Join-Path $nodeBin "node.exe"
            & $nodeExe "--env-file=.env" "node_modules\.bin\tsx" "prisma\seed.ts" 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { Write-Ok "Seed ejecutado" }
            else { Write-Warn "Seed fallo (no critico)" }
        } catch { Write-Warn "No se pudo correr el seed" }
        finally { Pop-Location }
    }
}

# Registrar server de Node
$nodeExe = Join-Path $nodeBin "node.exe"
$serverEntry = Join-Path $serverDir "dist\index.js"
$serverSvc = Get-Service -Name $serverService -ErrorAction SilentlyContinue
if (-not $serverSvc) {
    Write-Host "  Registrando IMBIO Server como servicio..." -ForegroundColor Yellow
    & $nssm install $serverService $nodeExe @("`"$serverEntry`"") 2>&1 | Out-Null
    & $nssm set $serverService AppDirectory $serverDir 2>&1 | Out-Null
    & $nssm set $serverService AppEnvironmentExtra "PATH=$nodeBin;$pgBin\bin" 2>&1 | Out-Null
    & $nssm set $serverService DisplayName "IMBIO Server" 2>&1 | Out-Null
    & $nssm set $serverService Description "Servidor backend de IMBIO" 2>&1 | Out-Null
    & $nssm set $serverService Start SERVICE_AUTO_START 2>&1 | Out-Null
    & $nssm set $serverService DependOnService $pgService 2>&1 | Out-Null
    & $nssm set $serverService AppStdout "$progData\logs\server.log" 2>&1 | Out-Null
    & $nssm set $serverService AppStderr "$progData\logs\server-error.log" 2>&1 | Out-Null
    & $nssm set $serverService AppRotateFiles 1 2>&1 | Out-Null
    & $nssm set $serverService AppRotateBytes 10485760 2>&1 | Out-Null
    Write-Ok "Servicio $serverService registrado"
} else {
    Write-Ok "Servicio $serverService ya existe"
}

# Iniciar server
Write-Host "  Iniciando IMBIO Server..." -ForegroundColor Yellow
Start-Service -Name $serverService
$deadline = (Get-Date).AddSeconds(30)
$serverReady = $false
while ((Get-Date) -lt $deadline) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.BeginConnect("127.0.0.1", $ServerPort, $null, $null) | Out-Null
        Start-Sleep -Milliseconds 200
        if ($tcp.Connected) { $serverReady = $true; $tcp.Close(); break }
        $tcp.Close()
    } catch { }
    Start-Sleep -Milliseconds 500
}
if (-not $serverReady) {
    Write-Err "Server no arranco. Revisa el log:"
    Write-Host "    notepad $progData\logs\server.log"
} else {
    Write-Ok "IMBIO Server corriendo en puerto $ServerPort"
}

# Firewall
Write-Step "Configurando firewall"
$ruleName = "IMBIO Server (puerto $ServerPort)"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $ServerPort -Action Allow -Profile Any 2>&1 | Out-Null
    Write-Ok "Firewall abierto para puerto $ServerPort"
} else {
    Write-Ok "Regla de firewall ya existe"
}

# Guardar config.json
$config = @{
    serverUrl = "http://localhost:$ServerPort"
    mode = "server"
} | ConvertTo-Json -Depth 10
Set-Content -Path (Join-Path $progData "config.json") -Value $config -Encoding UTF8
Write-Ok "Configuracion guardada en ProgramData\IMBIO\config.json"

# Acceso directo "IMBIO Server Manager" en escritorio
Write-Step "Creando acceso directo en escritorio"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop "IMBIO Server Manager.lnk"))
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoExit -Command `"Get-Service ImbioServer,ImbioPostgreSQL | Format-Table -AutoSize; Write-Host ''; Write-Host 'Reiniciar: Restart-Service ImbioServer' -ForegroundColor Cyan; Write-Host 'Logs: notepad C:\ProgramData\IMBIO\logs\server.log' -ForegroundColor Cyan`""
$shortcut.WorkingDirectory = $InstallDir
$shortcut.IconLocation = "powershell.exe,0"
$shortcut.Description = "Administrar IMBIO Server"
$shortcut.Save()
Write-Ok "Acceso directo creado en escritorio"

# Resumen
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  IMBIO Server instalado correctamente" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  URL local:     http://localhost:$ServerPort" -ForegroundColor White
Write-Host "  PostgreSQL:    127.0.0.1:$PostgresPort (user=imbio, db=imbio)" -ForegroundColor White
Write-Host "  Datos:         $progData" -ForegroundColor White
Write-Host "  Logs:          $progData\logs" -ForegroundColor White
Write-Host ""
Write-Host "  Acceso directo en escritorio: 'IMBIO Server Manager'" -ForegroundColor Cyan
Write-Host "  Servicios:" -ForegroundColor White
Write-Host "    - ImbioPostgreSQL (auto-arranque)" -ForegroundColor Gray
Write-Host "    - ImbioServer (auto-arranque, depende de PostgreSQL)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Las PCs en la LAN deben conectarse a:" -ForegroundColor White
$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
     Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
     Select-Object -First 1
if ($ip) {
    Write-Host "    http://$($ip.IPAddress):$ServerPort" -ForegroundColor Cyan
}
Write-Host ""
Write-Log "Setup completado"
