# =================================================================
# install.ps1 — Wrapper principal del instalador IMBIO
# =================================================================
# Llama a install-server.ps1 o install-client.ps1 según el modo.
# Tiene un wrapper try/catch que captura CUALQUIER error y muestra
# el log antes de cerrar la ventana.
# =================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateSet("server", "client")] [string]$Mode,
    [Parameter(Mandatory)] [string]$InstallDir,
    [string]$ServerUrl
)

# NO usar $ErrorActionPreference = "Stop" — queremos capturar
# TODOS los errores, no abortar al primero.
$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "IMBIO Setup - Modo: $Mode"

# Importar funciones comunes (con manejo de error)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# === CREAR LOG Y CARPETA ANTES DE CUALQUIER COSA ===
# Esto garantiza que siempre haya un log aunque algo falle temprano
$progDataLog = Join-Path $env:ProgramData "IMBIO\logs"
$logFile = Join-Path $progDataLog "install.log"
try {
    if (-not (Test-Path $progDataLog)) {
        New-Item -Path $progDataLog -ItemType Directory -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$timestamp] [INFO] install.ps1 iniciado (modo=$Mode, installDir=$InstallDir, scriptPath=$scriptPath)" | Add-Content -Path $logFile -ErrorAction SilentlyContinue
} catch {
    # Si ni siquiera podemos crear el log, mostramos en consola
    Write-Host "⚠ No se pudo crear log en $logFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMBIO Setup - Modo: $Mode" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  InstallDir: $InstallDir" -ForegroundColor Gray
Write-Host "  Log:        $logFile" -ForegroundColor Gray
Write-Host ""

# Ahora sí, importar common.ps1
try {
    . (Join-Path $scriptPath "common.ps1")
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INFO] common.ps1 cargado" | Add-Content -Path $logFile -ErrorAction SilentlyContinue
} catch {
    $errMsg = "ERROR: No se pudo cargar common.ps1 desde $scriptPath. Detalle: $($_.Exception.Message)"
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ERROR" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  $errMsg" -ForegroundColor Red
    $errMsg | Add-Content -Path $logFile -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "  Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Initialize-IMBIODirectories
"[$((Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))] [INFO] Setup iniciado" | Add-Content -Path $logFile -ErrorAction SilentlyContinue

# --- 0. Descomprimir el bundle del server ---
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
        } catch {
            Write-Err "Error descomprimiendo el bundle: $($_.Exception.Message)"
            Write-Log "ERROR descomprimiendo bundle: $($_.Exception.Message)"
            Pause-And-Exit 1
        }
    } else {
        Write-Ok "Bundle ya descomprimido"
    }
} else {
    Write-Warn "No se encontró server-bundle.zip"
    Write-Log "WARN: server-bundle.zip no encontrado"
}

# --- 1. Verificar / descargar binarios externos ---
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
    Write-Host "  (Esto puede tardar unos minutos dependiendo de tu conexion)" -ForegroundColor Gray
    Write-Host ""

    $downloadScript = Join-Path $scriptPath "download-binaries.ps1"
    if (-not (Test-Path $downloadScript)) {
        Write-Err "No se encontró download-binaries.ps1"
        Write-Log "ERROR: download-binaries.ps1 no encontrado"
        Pause-And-Exit 1
    }

    try {
        & $downloadScript -InstallDir $InstallDir -Components $binariosFaltantes
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Falló la descarga de binarios (exit code $LASTEXITCODE)"
            Write-Log "ERROR: descarga de binarios falló (exit $LASTEXITCODE)"
            Pause-And-Exit 1
        }
        Write-Log "Binarios descargados OK"
    } catch {
        Write-Err "Error descargando binarios: $($_.Exception.Message)"
        Write-Log "ERROR descargando binarios: $($_.Exception.Message)"
        Pause-And-Exit 1
    }
    Write-Host ""
} else {
    Write-Ok "Todos los binarios externos ya están presentes"
}

# --- 2. Llamar al script específico del modo ---
try {
    switch ($Mode) {
        "server" {
            Write-Step "Iniciando instalación del servidor..."
            Write-Host ""
            & (Join-Path $scriptPath "install-server.ps1") `
                -InstallDir $InstallDir `
                -ServerPort 3000 `
                -PostgresPort 5432 `
                -RunSeed $true `
                -SkipFirewall $false
        }
        "client" {
            Write-Step "Iniciando configuración del cliente..."
            Write-Host ""

            if ([string]::IsNullOrWhiteSpace($ServerUrl)) {
                Write-Host "  Ingresa la URL del servidor IMBIO" -ForegroundColor White
                Write-Host "  (por ejemplo: http://192.168.0.10:3000)" -ForegroundColor Gray
                Write-Host ""
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
        Write-Err "La instalación falló (exit code $LASTEXITCODE)"
        Write-Log "ERROR: instalación falló (exit $LASTEXITCODE)"
        Pause-And-Exit $LASTEXITCODE
    }

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ Configuración completada" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Log "Setup completado exitosamente"
} catch {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ❌ ERROR DURANTE LA INSTALACIÓN" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  En: $($_.ScriptStackTrace)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Log completo en:" -ForegroundColor Yellow
    Write-Host "  C:\ProgramData\IMBIO\logs\install.log" -ForegroundColor White
    Write-Host ""
    Write-Log "ERROR FATAL: $($_.Exception.Message)"
    Pause-And-Exit 1
}

# Pausa al final para que el usuario vea el resultado
Write-Host ""
Write-Host "  Presiona cualquier tecla para cerrar esta ventana..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
