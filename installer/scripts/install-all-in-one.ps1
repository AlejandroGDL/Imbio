# =================================================================
# install-all-in-one.ps1
# =================================================================
# Script STANDALONE para configurar IMBIO. NO importa otros
# scripts, NO usa common.ps1, NO requiere archivos externos
# (excepto el server-bundle.zip que está junto a él).
#
# Toda la lógica está inline para evitar:
#   1. Archivos que no se actualizan en la PC destino
#   2. Errores de sintaxis por mezclar versiones
#   3. Problemas de paths largos al descomprimir
# =================================================================

# No usar [CmdletBinding()] ni param() (compatibilidad PS 5.1)

# ==== CREAR LOG EN LA PRIMERA LÍNEA ====
$logFile = "C:\ProgramData\IMBIO\logs\install.log"
$logDir  = "C:\ProgramData\IMBIO\logs"
$logWritten = $false
try {
    if (-not (Test-Path $logDir)) {
        New-Item -Path $logDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
    }
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INIT] install-all-in-one.ps1 INICIADO" | Out-File -FilePath $logFile -Encoding UTF8 -Append
    $logWritten = $true
} catch {
    $logFile = Join-Path $env:TEMP "imbio-install.log"
    try { "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INIT] (TEMP fallback) INICIADO" | Out-File -FilePath $logFile -Encoding UTF8 -Append; $logWritten = $true } catch { }
}

function Log($msg) {
    if ($logWritten) {
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg" | Out-File -FilePath $logFile -Encoding UTF8 -Append
    }
}

function Pause-Exit {
    param([int]$Code = 0)
    Write-Host ""
    Write-Host "  Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $Code
}

# ==== Parsear argumentos ====
$Mode = $null
$InstallDir = $null
$ServerUrl = $null
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq "-Mode" -and ($i + 1) -lt $args.Count) {
        $Mode = $args[$i + 1]
        $i++
    } elseif ($args[$i] -eq "-InstallDir" -and ($i + 1) -lt $args.Count) {
        $InstallDir = $args[$i + 1]
        $i++
    } elseif ($args[$i] -eq "-ServerUrl" -and ($i + 1) -lt $args.Count) {
        $ServerUrl = $args[$i + 1]
        $i++
    }
}

Log "[INFO] Args: Mode=$Mode, InstallDir=$InstallDir, ServerUrl=$ServerUrl"
Write-Host "IMBIO Setup - Modo: $Mode" -ForegroundColor Cyan
Write-Host "InstallDir: $InstallDir" -ForegroundColor Gray
Write-Host "Log: $logFile" -ForegroundColor Gray
Write-Host ""

if ([string]::IsNullOrEmpty($Mode) -or [string]::IsNullOrEmpty($InstallDir)) {
    Log "[FATAL] Faltan argumentos"
    Write-Host "  ✗ Faltan argumentos -Mode o -InstallDir" -ForegroundColor Red
    Pause-Exit 1
}

# ==== Constantes ====
$ServerPort   = 3000
$PostgresPort = 5432
$dbUser       = "imbio"
$dbName       = "imbio"
$nodeBin      = Join-Path $InstallDir "node"
$pgBin        = Join-Path $InstallDir "pgsql"
$nssmExe      = Join-Path $InstallDir "nssm.exe"
$serverDir    = Join-Path $InstallDir "server"
$progData     = Join-Path $env:ProgramData "IMBIO"
$pgData       = Join-Path $progData "data\postgresql"
$logsDir      = Join-Path $progData "logs"
$dataDir      = Join-Path $progData "data"
$configFile   = Join-Path $progData "config.json"

# ==== Funciones helper ====
function Test-Administrator {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $pr = New-Object Security.Principal.WindowsPrincipal($id)
    return $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Wait-PortOpen {
    param([string]$Host, [int]$Port, [int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.BeginConnect($Host, $Port, $null, $null) | Out-Null
            Start-Sleep -Milliseconds 100
            if ($tcp.Connected) { $tcp.Close(); return $true }
            $tcp.Close()
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function New-RandomPassword {
    param([int]$Length = 24)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $result = ""
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    for ($i = 0; $i -lt $Length; $i++) {
        $bytes = New-Object byte[] 1
        $rng.GetBytes($bytes)
        $result += $chars[$bytes[0] % $chars.Length]
    }
    return $result
}

function New-RandomSecret {
    param([int]$Length = 64)
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return [Convert]::ToHexString($bytes).ToLower()
}

# ==== Verificar admin ====
Log "[STEP] Verificando permisos de administrador"
if (-not (Test-Administrator)) {
    Log "[FATAL] No se ejecuta como administrador"
    Write-Host "  ✗ Este script DEBE ejecutarse como Administrador" -ForegroundColor Red
    Write-Host "  Clic derecho en PowerShell -> Ejecutar como administrador" -ForegroundColor Yellow
    Pause-Exit 1
}
Log "[INFO] Ejecutando como administrador OK"
Write-Host "  ✓ Ejecutando como administrador" -ForegroundColor Green

# ==== Crear directorios ====
Log "[STEP] Creando directorios de datos"
foreach ($dir in @($progData, $logsDir, $dataDir, $pgData, $nodeBin, $pgBin)) {
    if (-not (Test-Path $dir)) {
        try { New-Item -Path $dir -ItemType Directory -Force -ErrorAction Stop | Out-Null } catch { }
    }
}
Log "[INFO] Directorios creados"

# ==== Descomprimir el bundle del server ====
Log "[STEP] Descomprimiendo server-bundle.zip"
Write-Host "▶ Descomprimiendo bundle del servidor..." -ForegroundColor Cyan
$bundleZip = Join-Path $InstallDir "resources\server-bundle.zip"
Log "[INFO] bundleZip: $bundleZip"

if (Test-Path $bundleZip) {
    if (Test-Path (Join-Path $serverDir "dist\index.js")) {
        Log "[INFO] Bundle ya descomprimido"
        Write-Host "  ✓ Bundle ya descomprimido" -ForegroundColor Green
    } else {
        try {
            if (Test-Path $serverDir) { Remove-Item -Path $serverDir -Recurse -Force -ErrorAction SilentlyContinue }
            New-Item -Path $serverDir -ItemType Directory -Force | Out-Null

            # Usar ZipFile directo para evitar problemas de paths largos
            # (Expand-Archive falla con paths > 260 chars en PowerShell 5.1)
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $zip = [System.IO.Compression.ZipFile]::OpenRead($bundleZip)
            try {
                foreach ($entry in $zip.Entries) {
                    $destPath = Join-Path $serverDir $entry.FullName
                    if ($entry.FullName.EndsWith("/")) {
                        # Es un directorio
                        if (-not (Test-Path $destPath)) {
                            New-Item -Path $destPath -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
                        }
                    } else {
                        # Es un archivo
                        $destDir = Split-Path -Parent $destPath
                        if (-not (Test-Path $destDir)) {
                            New-Item -Path $destDir -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
                        }
                        $out = [System.IO.File]::Create($destPath)
                        try {
                            $entryStream = $entry.Open()
                            $entryStream.CopyTo($out)
                        } finally {
                            $out.Close()
                            $entryStream.Close()
                        }
                    }
                }
            } finally {
                $zip.Close()
            }
            Log "[INFO] Bundle descomprimido OK usando ZipFile directo"
            Write-Host "  ✓ Bundle descomprimido" -ForegroundColor Green
        } catch {
            $err = "Error descomprimiendo: $($_.Exception.Message)"
            Log "[ERROR] $err"
            Write-Host "  ✗ $err" -ForegroundColor Red
            Pause-Exit 1
        }
    }
} else {
    Log "[WARN] server-bundle.zip no encontrado"
    Write-Host "  ⚠ server-bundle.zip no encontrado" -ForegroundColor Yellow
}

# ==== Verificar / descargar binarios externos ====
Log "[STEP] Verificando binarios externos"
Write-Host ""
Write-Host "▶ Verificando binarios externos..." -ForegroundColor Cyan

$nodeExe = Join-Path $nodeBin "node.exe"
$pgCtl   = Join-Path $pgBin "bin\pg_ctl.exe"
$pgInitdb = Join-Path $pgBin "bin\initdb.exe"
$psql    = Join-Path $pgBin "bin\psql.exe"

$binariosFaltantes = @()
if (-not (Test-Path $nodeExe)) { $binariosFaltantes += "Node.js" }
if ($Mode -eq "server") {
    if (-not (Test-Path $pgCtl)) { $binariosFaltantes += "PostgreSQL" }
    if (-not (Test-Path $nssmExe)) { $binariosFaltantes += "nssm" }
}

if ($binariosFaltantes.Count -gt 0) {
    Log "[INFO] Descargando: $($binariosFaltantes -join ', ')"
    Write-Host "  Descargando: $($binariosFaltantes -join ', ')..." -ForegroundColor Yellow
    Write-Host "  (Esto puede tardar unos minutos)" -ForegroundColor Gray

    $tmpDir = Join-Path $env:TEMP "imbio-downloads-$([guid]::NewGuid().ToString('N').Substring(0,8))"
    New-Item -Path $tmpDir -ItemType Directory -Force | Out-Null

    # Función para descargar y descomprimir
    function Download-Extract {
        param($Url, $ZipName, $ExtractTo, $MinSizeMB = 10)
        $zipPath = Join-Path $tmpDir $ZipName
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $Url -OutFile $zipPath -UseBasicParsing -TimeoutSec 600
            $size = (Get-Item $zipPath).Length
            if ($size -lt ($MinSizeMB * 1MB)) {
                throw "Archivo demasiado pequeño: $size bytes"
            }
            # Descomprimir usando ZipFile directo (sin problemas de path)
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
            try {
                foreach ($entry in $zip.Entries) {
                    $destPath = Join-Path $ExtractTo $entry.FullName
                    if ($entry.FullName.EndsWith("/")) {
                        if (-not (Test-Path $destPath)) {
                            New-Item -Path $destPath -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
                        }
                    } else {
                        $destDir = Split-Path -Parent $destPath
                        if (-not (Test-Path $destDir)) {
                            New-Item -Path $destDir -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
                        }
                        $out = [System.IO.File]::Create($destPath)
                        try {
                            $entryStream = $entry.Open()
                            $entryStream.CopyTo($out)
                        } finally {
                            $out.Close()
                            $entryStream.Close()
                        }
                    }
                }
            } finally {
                $zip.Close()
            }
            return $true
        } catch {
            Log "[ERROR] Descargando $Url : $($_.Exception.Message)"
            Write-Host "  ✗ Error descargando $Url : $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    }

    # Node.js
    if ($binariosFaltantes -contains "Node.js") {
        Write-Host "  Descargando Node.js (30 MB)..." -ForegroundColor Gray
        if (Download-Extract "https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip" "node.zip" $nodeBin 20) {
            # El zip tiene un subdirectorio "node-v22.11.0-win-x64/" - mover contenido
            $subdir = Get-ChildItem -Path $nodeBin -Directory | Where-Object { $_.Name -like "node-v*" } | Select-Object -First 1
            if ($null -ne $subdir) {
                Get-ChildItem -Path $subdir.FullName -Force | ForEach-Object {
                    Move-Item -Path $_.FullName -Destination $nodeBin -Force
                }
                Remove-Item -Path $subdir.FullName -Recurse -Force
            }
            Write-Host "  ✓ Node.js instalado" -ForegroundColor Green
        } else { Pause-Exit 1 }
    }

    # PostgreSQL
    if ($binariosFaltantes -contains "PostgreSQL") {
        Write-Host "  Descargando PostgreSQL (80 MB)..." -ForegroundColor Gray
        if (Download-Extract "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip" "pg.zip" $pgBin 70) {
            # El zip tiene un subdirectorio "pgsql/"
            $subdir = Join-Path $pgBin "pgsql"
            if (Test-Path $subdir) {
                Get-ChildItem -Path $subdir -Force | ForEach-Object {
                    Move-Item -Path $_.FullName -Destination $pgBin -Force
                }
                Remove-Item -Path $subdir -Recurse -Force
            }
            Write-Host "  ✓ PostgreSQL instalado" -ForegroundColor Green
        } else { Pause-Exit 1 }
    }

    # nssm
    if ($binariosFaltantes -contains "nssm") {
        Write-Host "  Descargando nssm (1 MB)..." -ForegroundColor Gray
        if (Download-Extract "https://nssm.cc/release/nssm-2.24.zip" "nssm.zip" $InstallDir 0.5) {
            $nssmSrc = Get-ChildItem -Path $InstallDir -Recurse -Filter "nssm.exe" |
                       Where-Object { $_.DirectoryName -like "*win64*" } | Select-Object -First 1
            if ($null -ne $nssmSrc) {
                Move-Item -Path $nssmSrc.FullName -Destination $nssmExe -Force
                Write-Host "  ✓ nssm instalado" -ForegroundColor Green
            } else {
                Write-Host "  ✗ No se encontró nssm.exe en el zip" -ForegroundColor Red
                Pause-Exit 1
            }
        } else { Pause-Exit 1 }
    }

    Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "  ✓ Todos los binarios ya están presentes" -ForegroundColor Green
}
Log "[INFO] Binarios listos"

# ==== MODO CLIENTE: solo guardar URL ====
if ($Mode -eq "client") {
    Log "[STEP] Modo cliente - guardando URL"
    Write-Host ""
    Write-Host "▶ Configurando cliente..." -ForegroundColor Cyan

    if ([string]::IsNullOrEmpty($ServerUrl)) {
        $ServerUrl = Read-Host "  Ingresa la URL del servidor IMBIO (ej: http://192.168.0.10:3000)"
    }

    $config = @{
        serverUrl = $ServerUrl
        mode      = "client"
    } | ConvertTo-Json -Depth 10
    Set-Content -Path $configFile -Value $config -Encoding UTF8
    Log "[INFO] Config cliente guardado"
    Write-Host "  ✓ Cliente configurado" -ForegroundColor Green
    Write-Host "  URL: $ServerUrl" -ForegroundColor White

    Pause-Exit 0
}

# ==== MODO SERVIDOR: instalación completa ====
Log "[STEP] Iniciando instalación del servidor"
Write-Host ""
Write-Host "▶ Instalando servidor IMBIO..." -ForegroundColor Cyan

# Verificar prerrequisitos
$prereqs = @{
    "Node.js"     = $nodeExe
    "PostgreSQL"  = $pgCtl
    "Server"      = Join-Path $serverDir "dist\index.js"
    "nssm"        = $nssmExe
}
$missing = $prereqs.Keys | Where-Object { -not (Test-Path $prereqs[$_]) }
if ($missing.Count -gt 0) {
    Log "[FATAL] Faltan archivos: $($missing -join ', ')"
    Write-Host "  ✗ Faltan: $($missing -join ', ')" -ForegroundColor Red
    Pause-Exit 1
}
Log "[INFO] Prerrequisitos OK"

# 1. Generar secretos
Log "[STEP] Generando secretos"
$jwtSecret = New-RandomSecret -Length 64
$dbPassword = New-RandomPassword -Length 24
Write-Host "  ✓ Secretos generados" -ForegroundColor Green

# 2. Generar .env
Log "[STEP] Generando .env"
$envContent = @"
NODE_ENV=production
PORT=$ServerPort
HOST=0.0.0.0
LOG_LEVEL=info
DATABASE_URL=postgresql://${dbUser}:${dbPassword}@127.0.0.1:${PostgresPort}/${dbName}?schema=public
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=8h
CORS_ORIGINS=*
AUTO_SEED=true
"@
$envFile = Join-Path $serverDir ".env"
Set-Content -Path $envFile -Value $envContent -Encoding UTF8
Log "[INFO] .env escrito en $envFile"
Write-Host "  ✓ .env escrito" -ForegroundColor Green

# 3. Inicializar PostgreSQL
Log "[STEP] Inicializando PostgreSQL"
if (-not (Test-Path (Join-Path $pgData "PG_VERSION"))) {
    Write-Host "  Corriendo initdb..." -ForegroundColor Yellow
    $initdbArgs = @("-D", "`"$pgData`"", "-U", $dbUser, "--auth=md5", "--encoding=UTF8", "--locale=C", "-E", "UTF8")
    $p = Start-Process -FilePath $pgInitdb -ArgumentList $initdbArgs -NoNewWindow -Wait -PassThru
    if ($p.ExitCode -ne 0) {
        Log "[FATAL] initdb fallo con codigo $($p.ExitCode)"
        Write-Host "  ✗ initdb falló" -ForegroundColor Red
        Pause-Exit 1
    }

    # Configurar postgresql.conf
    $pgConf = Join-Path $pgData "postgresql.conf"
    Add-Content -Path $pgConf -Value @"

# IMBIO installer config
listen_addresses = '127.0.0.1'
port = $PostgresPort
unix_socket_directories = '$pgData'
"@
    $pgHba = Join-Path $pgData "pg_hba.conf"
    Add-Content -Path $pgHba -Value @"

# IMBIO installer rules
host    all    all    127.0.0.1/32    md5
"@
    Log "[INFO] Cluster PostgreSQL inicializado"
    Write-Host "  ✓ Cluster PostgreSQL inicializado" -ForegroundColor Green
} else {
    Write-Host "  ✓ Cluster ya existe" -ForegroundColor Green
}

# 4. Registrar servicio PostgreSQL
Log "[STEP] Registrando servicio PostgreSQL"
$pgServiceName = "ImbioPostgreSQL"
$pgSvc = Get-Service -Name $pgServiceName -ErrorAction SilentlyContinue
if (-not $pgSvc) {
    & $nssmExe install $pgServiceName $pgCtl @("start", "-D", "`"$pgData`"", "-l", "`"$logsDir\postgresql.log`"", "-w") 2>&1 | Out-Null
    & $nssmExe set $pgServiceName AppDirectory $pgData 2>&1 | Out-Null
    & $nssmExe set $pgServiceName DisplayName "IMBIO PostgreSQL" 2>&1 | Out-Null
    & $nssmExe set $pgServiceName Description "PostgreSQL local para IMBIO" 2>&1 | Out-Null
    & $nssmExe set $pgServiceName Start SERVICE_AUTO_START 2>&1 | Out-Null
    Log "[INFO] Servicio PostgreSQL registrado"
    Write-Host "  ✓ Servicio PostgreSQL registrado" -ForegroundColor Green
}

# 5. Iniciar PostgreSQL
Log "[STEP] Iniciando PostgreSQL"
$pgSvc = Get-Service -Name $pgServiceName
if ($pgSvc.Status -ne "Running") {
    Start-Service -Name $pgServiceName
    Start-Sleep -Seconds 3
}
if (-not (Wait-PortOpen -Host "127.0.0.1" -Port $PostgresPort -TimeoutSeconds 30)) {
    Log "[FATAL] PostgreSQL no arranco"
    Write-Host "  ✗ PostgreSQL no respondió en puerto $PostgresPort" -ForegroundColor Red
    Pause-Exit 1
}
Log "[INFO] PostgreSQL corriendo en puerto $PostgresPort"
Write-Host "  ✓ PostgreSQL corriendo en puerto $PostgresPort" -ForegroundColor Green

# 6. Crear DB y usuario
Log "[STEP] Configurando base de datos"
$env:PGPASSWORD = ""
& $psql -h 127.0.0.1 -p $PostgresPort -U $dbUser -d postgres -c "ALTER USER $dbUser WITH PASSWORD '$dbPassword' SUPERUSER;" 2>&1 | Out-Null
$env:PGPASSWORD = $dbPassword
$test = & $psql -h 127.0.0.1 -p $PostgresPort -U $dbUser -d $dbName -c "SELECT 1" 2>&1
$env:PGPASSWORD = ""
if ($LASTEXITCODE -ne 0) {
    $dbCheck = & $psql -h 127.0.0.1 -p $PostgresPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'" 2>&1
    if ($dbCheck -ne "1") {
        & $psql -h 127.0.0.1 -p $PostgresPort -U $dbUser -d postgres -c "CREATE DATABASE $dbName OWNER $dbUser" 2>&1 | Out-Null
        $env:PGPASSWORD = $dbPassword
        $test = & $psql -h 127.0.0.1 -p $PostgresPort -U $dbUser -d $dbName -c "SELECT 1" 2>&1
        $env:PGPASSWORD = ""
    }
    if ($LASTEXITCODE -ne 0) {
        Log "[FATAL] No se pudo crear/conectar a la BD"
        Pause-Exit 1
    }
}
Log "[INFO] BD configurada OK"
Write-Host "  ✓ BD configurada" -ForegroundColor Green

# 7. Migraciones de Prisma
Log "[STEP] Aplicando migraciones de Prisma"
$prisma = Join-Path $serverDir "node_modules\.bin\prisma.cmd"
if (-not (Test-Path $prisma)) {
    $prisma = Join-Path $serverDir "node_modules\.bin\prisma.ps1"
}
if (-not (Test-Path $prisma)) {
    Log "[FATAL] Prisma no encontrado"
    Pause-Exit 1
}
Push-Location $serverDir
try {
    & $prisma migrate deploy 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Log "[WARN] Migraciones de Prisma fallaron, continuando..."
    } else {
        Log "[INFO] Migraciones aplicadas"
        Write-Host "  ✓ Migraciones aplicadas" -ForegroundColor Green
    }
} finally { Pop-Location }

# 8. Registrar servicio IMBIO Server
Log "[STEP] Registrando servicio IMBIO Server"
$serverServiceName = "ImbioServer"
$serverEntry = Join-Path $serverDir "dist\index.js"
$serverSvc = Get-Service -Name $serverServiceName -ErrorAction SilentlyContinue
if (-not $serverSvc) {
    & $nssmExe install $serverServiceName $nodeExe @("`"$serverEntry`"") 2>&1 | Out-Null
    & $nssmExe set $serverServiceName AppDirectory $serverDir 2>&1 | Out-Null
    & $nssmExe set $serverServiceName AppEnvironmentExtra "PATH=$nodeBin;$pgBin\bin" 2>&1 | Out-Null
    & $nssmExe set $serverServiceName DisplayName "IMBIO Server" 2>&1 | Out-Null
    & $nssmExe set $serverServiceName Description "Servidor backend de IMBIO" 2>&1 | Out-Null
    & $nssmExe set $serverServiceName Start SERVICE_AUTO_START 2>&1 | Out-Null
    & $nssmExe set $serverServiceName DependOnService $pgServiceName 2>&1 | Out-Null
    & $nssmExe set $serverServiceName AppStdout "$logsDir\server.log" 2>&1 | Out-Null
    & $nssmExe set $serverServiceName AppStderr "$logsDir\server-error.log" 2>&1 | Out-Null
    Log "[INFO] Servicio IMBIO Server registrado"
    Write-Host "  ✓ Servicio IMBIO Server registrado" -ForegroundColor Green
}

# 9. Iniciar IMBIO Server
Log "[STEP] Iniciando IMBIO Server"
Start-Service -Name $serverServiceName
if (-not (Wait-PortOpen -Host "127.0.0.1" -Port $ServerPort -TimeoutSeconds 30)) {
    Log "[WARN] IMBIO Server no respondio en puerto $ServerPort"
    Write-Host "  ⚠ Server no respondió en puerto $ServerPort" -ForegroundColor Yellow
    Write-Host "  Revisa el log: $logsDir\server.log" -ForegroundColor Gray
} else {
    Log "[INFO] IMBIO Server corriendo en puerto $ServerPort"
    Write-Host "  ✓ IMBIO Server corriendo en puerto $ServerPort" -ForegroundColor Green
}

# 10. Firewall
Log "[STEP] Configurando firewall"
$ruleName = "IMBIO Server (puerto $ServerPort)"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $ServerPort -Action Allow -Profile Any 2>&1 | Out-Null
    Write-Host "  ✓ Firewall abierto para puerto $ServerPort" -ForegroundColor Green
}

# 11. Guardar config.json
Log "[STEP] Guardando config.json"
$config = @{
    serverUrl = "http://localhost:$ServerPort"
    mode      = "server"
} | ConvertTo-Json -Depth 10
Set-Content -Path $configFile -Value $config -Encoding UTF8
Log "[INFO] config.json guardado"

# ==== Resumen ====
Log "[DONE] Instalacion completada exitosamente"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  IMBIO Server instalado correctamente" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  URL: http://localhost:$ServerPort" -ForegroundColor White
Write-Host "  Servicios:" -ForegroundColor White
Write-Host "    - ImbioPostgreSQL (auto-arranque)" -ForegroundColor Gray
Write-Host "    - ImbioServer     (auto-arranque)" -ForegroundColor Gray
Write-Host "  Log: $logFile" -ForegroundColor White
Write-Host ""
Write-Host "  Presiona cualquier tecla para cerrar..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
