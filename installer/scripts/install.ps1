# =================================================================
# install.ps1 — Wrapper que decide qué hacer según el modo
# =================================================================
# Este script es el entry point que el instalador NSIS llama.
# Su trabajo es:
#   1. Verificar que los binarios externos (Node, PostgreSQL, nssm)
#      estén disponibles; si no, descargarlos.
#   2. Según el modo (server/client), llamar al script correspondiente.
#
# Parámetros:
#   -Mode         "server" | "client"
#   -InstallDir   Carpeta de instalación de IMBIO
#   -ServerUrl    (solo cliente) URL del servidor
# =================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateSet("server", "client")] [string]$Mode,
    [Parameter(Mandatory)] [string]$InstallDir,
    [string]$ServerUrl
)

# Configurar consola con colores
$Host.UI.RawUI.WindowTitle = "IMBIO Setup — Configurando ($Mode)"

# Importar funciones comunes
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptPath "common.ps1")

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMBIO Setup — Modo: $Mode" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

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
    Write-Host "  (Esto puede tardar unos minutos dependiendo de tu conexión)" -ForegroundColor Gray
    Write-Host ""

    $downloadScript = Join-Path $scriptPath "download-binaries.ps1"
    if (-not (Test-Path $downloadScript)) {
        Write-Err "No se encontró download-binaries.ps1"
        exit 1
    }

    & $downloadScript -InstallDir $InstallDir -Components $binariosFaltantes
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Falló la descarga de binarios"
        exit 1
    }
    Write-Host ""
} else {
    Write-Ok "Todos los binarios externos ya están presentes"
}

# --- 2. Llamar al script específico del modo ---
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

        # Si no se pasó la URL, pedirla
        if ([string]::IsNullOrWhiteSpace($ServerUrl)) {
            Write-Host "  Ingresa la URL del servidor IMBIO" -ForegroundColor White
            Write-Host "  (por ejemplo: http://192.168.0.10:3000)" -ForegroundColor Gray
            Write-Host ""
            $inputUrl = Read-Host "  URL del servidor"
            if ([string]::IsNullOrWhiteSpace($inputUrl)) {
                Write-Err "No se proporcionó URL del servidor"
                exit 1
            }
            $ServerUrl = $inputUrl
        }

        & (Join-Path $scriptPath "install-client.ps1") `
            -InstallDir $InstallDir `
            -ServerUrl $ServerUrl
    }
    default {
        Write-Err "Modo desconocido: $Mode"
        exit 1
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Err "La instalación falló"
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ Configuración completada" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
