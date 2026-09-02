# =================================================================
# install.ps1 - COMPLETO CON LOGGING EN CADA PASO
# =================================================================
# Wrapper principal: descomprime bundle, descarga binarios, instala
# según el modo (server o client).
#
# IMPORTANTE: Sin [CmdletBinding()] ni param() por compatibilidad
# con PowerShell 5.1. Parsing manual de args.
# =================================================================

# ==== CREAR LOG EN LA PRIMERA LÍNEA ====
$logFile = "C:\ProgramData\IMBIO\logs\install.log"
$logDir  = "C:\ProgramData\IMBIO\logs"

$logWritten = $false
try {
    if (-not (Test-Path $logDir)) {
        New-Item -Path $logDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
    }
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INIT] install.ps1 (version COMPLETA) INICIADO" | Out-File -FilePath $logFile -Encoding UTF8 -Append
    $logWritten = $true
} catch {
    $logFile = Join-Path $env:TEMP "imbio-install.log"
    try {
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INIT] install.ps1 (TEMP fallback) INICIADO" | Out-File -FilePath $logFile -Encoding UTF8 -Append
        $logWritten = $true
    } catch { }
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

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMBIO Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Log: $logFile" -ForegroundColor Gray
Write-Host ""

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
Write-Host "  Mode:       $Mode" -ForegroundColor White
Write-Host "  InstallDir: $InstallDir" -ForegroundColor White
Write-Host ""

# ==== Validar argumentos ====
if ([string]::IsNullOrEmpty($Mode)) {
    Log "[FATAL] No se proporciono -Mode"
    Write-Err "Falta -Mode"
    Pause-Exit 1
}
if ([string]::IsNullOrEmpty($InstallDir)) {
    Log "[FATAL] No se proporciono -InstallDir"
    Write-Err "Falta -InstallDir"
    Pause-Exit 1
}
if (-not (Test-Path $InstallDir)) {
    Log "[FATAL] InstallDir no existe: $InstallDir"
    Write-Err "InstallDir no existe: $InstallDir"
    Pause-Exit 1
}

# ==== Cargar common.ps1 ====
Log "[STEP] Cargando common.ps1"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$commonPath = Join-Path $scriptPath "common.ps1"
if (-not (Test-Path $commonPath)) {
    Log "[FATAL] common.ps1 no existe en $commonPath"
    Write-Err "common.ps1 no encontrado"
    if (Test-Path $scriptPath) {
        Write-Host "  Archivos en $scriptPath :" -ForegroundColor Yellow
        Get-ChildItem $scriptPath | ForEach-Object { Write-Host "    - $($_.Name)" }
    }
    Pause-Exit 1
}

try {
    . $commonPath
    Log "[INFO] common.ps1 cargado OK"
}
catch {
    Log "[FATAL] Error cargando common.ps1: $($_.Exception.Message)"
    Write-Err "Error en common.ps1: $($_.Exception.Message)"
    Pause-Exit 1
}

# ==== Descomprimir el bundle del server ====
Log "[STEP] Descomprimiendo server-bundle.zip"
Write-Host ""
Write-Host "▶ Descomprimiendo bundle del servidor..." -ForegroundColor Cyan

$bundleZip = Join-Path $InstallDir "resources\server-bundle.zip"
$serverDir = Join-Path $InstallDir "server"
Log "[INFO] bundleZip: $bundleZip"

if (Test-Path $bundleZip) {
    if (Test-Path (Join-Path $serverDir "dist\index.js")) {
        Log "[INFO] Bundle ya descomprimido (dist/index.js existe)"
        Write-Ok "Bundle ya descomprimido"
    } else {
        try {
            if (Test-Path $serverDir) { Remove-Item -Path $serverDir -Recurse -Force }
            New-Item -Path $serverDir -ItemType Directory -Force | Out-Null
            Log "[INFO] Expand-Archive iniciado"
            Expand-Archive -Path $bundleZip -DestinationPath $InstallDir -Force
            $extractedDir = Join-Path $InstallDir "server-bundle"
            if (Test-Path $extractedDir) {
                Get-ChildItem -Path $extractedDir | ForEach-Object {
                    Move-Item -Path $_.FullName -Destination $serverDir -Force
                }
                Remove-Item -Path $extractedDir -Recurse -Force
            }
            Log "[INFO] Bundle descomprimido OK en $serverDir"
            Write-Ok "Bundle descomprimido en $serverDir"
        }
        catch {
            $err = "Error descomprimiendo: $($_.Exception.Message)"
            Log "[ERROR] $err"
            Write-Err $err
            Pause-Exit 1
        }
    }
} else {
    Log "[WARN] server-bundle.zip no encontrado"
    Write-Warn "server-bundle.zip no encontrado, continuando sin el"
}

# ==== Verificar / descargar binarios externos ====
Log "[STEP] Verificando binarios externos"
Write-Host ""
Write-Host "▶ Verificando binarios externos..." -ForegroundColor Cyan

$nodeExe = Join-Path $InstallDir "node\node.exe"
$pgCtl   = Join-Path $InstallDir "pgsql\bin\pg_ctl.exe"
$nssmExe = Join-Path $InstallDir "nssm.exe"

$binariosFaltantes = @()
if (-not (Test-Path $nodeExe)) { $binariosFaltantes += "Node.js" }
if ($Mode -eq "server") {
    if (-not (Test-Path $pgCtl)) { $binariosFaltantes += "PostgreSQL" }
    if (-not (Test-Path $nssmExe)) { $binariosFaltantes += "nssm" }
}

Log "[INFO] Binarios faltantes: $($binariosFaltantes -join ', ')"
Write-Host "  Binarios faltantes: $($binariosFaltantes -join ', ')" -ForegroundColor Gray

if ($binariosFaltantes.Count -gt 0) {
    Write-Host "▶ Descargando: $($binariosFaltantes -join ', ')..." -ForegroundColor Cyan
    $downloadScript = Join-Path $scriptPath "download-binaries.ps1"
    if (-not (Test-Path $downloadScript)) {
        Log "[FATAL] download-binaries.ps1 no encontrado"
        Write-Err "download-binaries.ps1 no encontrado"
        Pause-Exit 1
    }
    try {
        Log "[INFO] Ejecutando download-binaries.ps1"
        & $downloadScript -InstallDir $InstallDir -Components $binariosFaltantes
        Log "[INFO] download-binaries.ps1 termino con exit code $LASTEXITCODE"
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Descarga fallo (exit $LASTEXITCODE)"
            Pause-Exit 1
        }
        Write-Ok "Binarios descargados"
    }
    catch {
        Log "[FATAL] Error descargando: $($_.Exception.Message)"
        Write-Err "Error: $($_.Exception.Message)"
        Pause-Exit 1
    }
} else {
    Write-Ok "Todos los binarios ya estan presentes"
}

# ==== Llamar al script especifico del modo ====
Log "[STEP] Llamando install-$Mode.ps1"
Write-Host ""
Write-Host "▶ Ejecutando install-$Mode.ps1..." -ForegroundColor Cyan

$modeScript = Join-Path $scriptPath "install-$Mode.ps1"
if (-not (Test-Path $modeScript)) {
    Log "[FATAL] install-$Mode.ps1 no encontrado"
    Write-Err "install-$Mode.ps1 no encontrado"
    Pause-Exit 1
}

try {
    if ($Mode -eq "server") {
        Log "[INFO] Ejecutando install-server.ps1"
        & $modeScript -InstallDir $InstallDir -ServerPort 3000 -PostgresPort 5432 -RunSeed $true -SkipFirewall $false
    } else {
        if ([string]::IsNullOrEmpty($ServerUrl)) {
            Write-Host "  Ingresa la URL del servidor IMBIO" -ForegroundColor White
            $ServerUrl = Read-Host "  URL del servidor"
        }
        Log "[INFO] Ejecutando install-client.ps1 con ServerUrl=$ServerUrl"
        & $modeScript -InstallDir $InstallDir -ServerUrl $ServerUrl
    }
    Log "[INFO] install-$Mode.ps1 termino con exit code $LASTEXITCODE"
    if ($LASTEXITCODE -ne 0) {
        Write-Err "install-$Mode.ps1 fallo (exit $LASTEXITCODE)"
        Pause-Exit $LASTEXITCODE
    }
    Write-Ok "install-$Mode.ps1 termino OK"
}
catch {
    Log "[FATAL] Error en install-$Mode.ps1: $($_.Exception.Message)"
    Write-Err "Error: $($_.Exception.Message)"
    Pause-Exit 1
}

# ==== Listo ====
Log "[DONE] Setup completado exitosamente"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Instalacion completada" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Presiona cualquier tecla para cerrar..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
