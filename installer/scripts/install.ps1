# =================================================================
# install.ps1 - Wrapper principal del instalador IMBIO
# =================================================================
# Llama a install-server.ps1 o install-client.ps1 según el modo.
# El log se crea en la primera línea para diagnosticar problemas.
# =================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateSet("server", "client")] [string]$Mode,
    [Parameter(Mandatory)] [string]$InstallDir,
    [string]$ServerUrl
)

# ==== CREAR LOG INMEDIATAMENTE ====
$logFile = "C:\ProgramData\IMBIO\logs\install.log"
$logDir  = "C:\ProgramData\IMBIO\logs"
if (-not (Test-Path $logDir)) {
    New-Item -Path $logDir -ItemType Directory -Force | Out-Null
}
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$ts] [INIT] install.ps1 INICIADO. Mode=$Mode, InstallDir=$InstallDir"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMBIO Setup - Modo: $Mode" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Log: $logFile" -ForegroundColor Gray
Write-Host ""

# Función local de pause
function Local-Pause-Exit {
    param([int]$ExitCode = 0)
    Write-Host ""
    Write-Host "  Exit code: $ExitCode" -ForegroundColor Yellow
    Write-Host "  Log: $logFile" -ForegroundColor Yellow
    Write-Host "  Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $ExitCode
}

# ==== Cargar common.ps1 ====
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$commonPath = Join-Path $scriptPath "common.ps1"
Add-Content -Path $logFile -Value "[$ts] [INFO] scriptPath=$scriptPath"

if (-not (Test-Path $commonPath)) {
    Add-Content -Path $logFile -Value "[$ts] [FATAL] common.ps1 NO EXISTE"
    Local-Pause-Exit 1
}

try {
    . $commonPath
    Add-Content -Path $logFile -Value "[$ts] [INFO] common.ps1 cargado OK"
}
catch {
    Add-Content -Path $logFile -Value "[$ts] [FATAL] common.ps1 error: $($_.Exception.Message)"
    Local-Pause-Exit 1
}

# ==== Descomprimir el bundle del server ====
$bundleZip = Join-Path $InstallDir "resources\server-bundle.zip"
$serverDir = Join-Path $InstallDir "server"
if (Test-Path $bundleZip) {
    if (-not (Test-Path (Join-Path $serverDir "dist\index.js"))) {
        Write-Step "Descomprimiendo server-bundle.zip..."
        Write-Log "Descomprimiendo server-bundle.zip"
        try {
            if (Test-Path $serverDir) { Remove-Item -Path $serverDir -Recurse -Force }
            New-Item -Path $serverDir -ItemType Directory -Force | Out-Null
            Expand-Archive -Path $bundleZip -DestinationPath $InstallDir -Force
            $extractedDir = Join-Path $InstallDir "server-bundle"
            if (Test-Path $extractedDir) {
                Get-ChildItem -Path $extractedDir | ForEach-Object {
                    Move-Item -Path $_.FullName -Destination $serverDir
                }
                Remove-Item -Path $extractedDir -Recurse -Force
            }
            Write-Ok "Bundle descomprimido en $serverDir"
            Write-Log "Bundle descomprimido OK"
        }
        catch {
            $err = "Error descomprimiendo bundle: $($_.Exception.Message)"
            Write-Err $err
            Write-Log "ERROR: $err"
            Pause-And-Exit 1
        }
    } else {
        Write-Ok "Bundle ya descomprimido"
    }
} else {
    Write-Warn "No se encontró server-bundle.zip"
    Write-Log "WARN: server-bundle.zip no encontrado"
}

# ==== Verificar / descargar binarios externos ====
$nodeExe = Join-Path $InstallDir "node\node.exe"
$pgCtl   = Join-Path $InstallDir "pgsql\bin\pg_ctl.exe"
$nssmExe = Join-Path $InstallDir "nssm.exe"

$binariosFaltantes = @()
if (-not (Test-Path $nodeExe)) { $binariosFaltantes += "Node.js" }
if ($Mode -eq "server") {
    if (-not (Test-Path $pgCtl)) { $binariosFaltantes += "PostgreSQL" }
    if (-not (Test-Path $nssmExe)) { $binariosFaltantes += "nssm" }
}

if ($binariosFaltantes.Count -gt 0) {
    Write-Step "Descargando binarios externos: $($binariosFaltantes -join ', ')"
    Write-Log "Descargando binarios: $($binariosFaltantes -join ', ')"

    $downloadScript = Join-Path $scriptPath "download-binaries.ps1"
    if (-not (Test-Path $downloadScript)) {
        $err = "download-binaries.ps1 no encontrado"
        Write-Err $err
        Write-Log "ERROR: $err"
        Pause-And-Exit 1
    }

    try {
        & $downloadScript -InstallDir $InstallDir -Components $binariosFaltantes
        if ($LASTEXITCODE -ne 0) {
            $err = "Descarga de binarios fallo (exit $LASTEXITCODE)"
            Write-Err $err
            Write-Log "ERROR: $err"
            Pause-And-Exit 1
        }
        Write-Log "Binarios descargados OK"
    }
    catch {
        $err = "Error descargando binarios: $($_.Exception.Message)"
        Write-Err $err
        Write-Log "ERROR: $err"
        Pause-And-Exit 1
    }
} else {
    Write-Ok "Todos los binarios externos ya están presentes"
}

# ==== Llamar al script específico del modo ====
try {
    switch ($Mode) {
        "server" {
            Write-Step "Iniciando instalación del servidor..."
            & (Join-Path $scriptPath "install-server.ps1") `
                -InstallDir $InstallDir `
                -ServerPort 3000 `
                -PostgresPort 5432 `
                -RunSeed $true `
                -SkipFirewall $false
        }
        "client" {
            Write-Step "Iniciando configuración del cliente..."

            if ([string]::IsNullOrWhiteSpace($ServerUrl)) {
                Write-Host "  Ingresa la URL del servidor IMBIO" -ForegroundColor White
                $inputUrl = Read-Host "  URL del servidor"
                if ([string]::IsNullOrWhiteSpace($inputUrl)) {
                    Write-Err "No se proporcionó URL del servidor"
                    Pause-And-Exit 1
                }
                $ServerUrl = $inputUrl
            }

            & (Join-Path $scriptPath "install-client.ps1") `
                -InstallDir $InstallDir `
                -ServerUrl $ServerUrl
        }
        default {
            Write-Err "Modo desconocido: $Mode"
            Pause-And-Exit 1
        }
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Err "La instalación falló (exit $LASTEXITCODE)"
        Write-Log "ERROR: instalación falló"
        Pause-And-Exit $LASTEXITCODE
    }

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ Configuración completada" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Log "Setup completado exitosamente"
}
catch {
    $err = "ERROR FATAL: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ❌ ERROR DURANTE LA INSTALACIÓN" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Log "FATAL: $($_.Exception.Message)"
    Pause-And-Exit 1
}

Write-Host ""
Write-Host "  Presiona cualquier tecla para cerrar..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
