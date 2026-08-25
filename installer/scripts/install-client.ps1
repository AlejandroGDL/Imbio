# =================================================================
# install-client.ps1
# =================================================================
# Configura esta PC como CLIENTE de IMBIO. Se ejecuta automáticamente
# desde el instalador NSIS cuando el usuario elige "Cliente".
#
# Qué hace:
#   1. Recibe la URL del servidor (la que el usuario escribió en el
#      wizard del instalador)
#   2. Verifica que el servidor sea alcanzable (ping HTTP)
#   3. Guarda config.json con {serverUrl, mode: client}
#
# Parámetros:
#   -InstallDir   Carpeta donde el instalador puso los archivos
#                 (default: C:\Program Files\IMBIO)
#   -ServerUrl    URL del servidor IMBIO (ej: http://192.168.0.10:3000)
# =================================================================

[CmdletBinding()]
param(
    [string]$InstallDir,
    [Parameter(Mandatory)] [string]$ServerUrl
)

# Importar funciones comunes
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptPath "common.ps1")

# --- Verificar administrador ---
if (-not (Test-Administrator)) {
    Write-Err "Este script debe ejecutarse como Administrador."
    exit 1
}

# --- Validar InstallDir ---
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = $Script:DefaultInstallDir
}

Initialize-IMBIODirectories
Write-Log "Configurando cliente IMBIO, servidor: $ServerUrl"

# --- Normalizar URL ---
Write-Step "Validando URL del servidor..."
$ServerUrl = $ServerUrl.Trim()
if ($ServerUrl -notmatch "^https?://") {
    $ServerUrl = "http://$ServerUrl"
    Write-Warn "Agregué 'http://' al inicio: $ServerUrl"
}
# Quitar / final si lo tiene
$ServerUrl = $ServerUrl.TrimEnd("/")
Write-Ok "URL: $ServerUrl"

# --- Probar conectividad ---
Write-Step "Probando conexión con el servidor..."
$healthUrl = "$ServerUrl/health"
try {
    $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Ok "Servidor respondió correctamente"
        try {
            $healthData = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($healthData.service) {
                Write-Ok "  Servicio: $($healthData.service)"
            }
            if ($healthData.version) {
                Write-Ok "  Versión: $($healthData.version)"
            }
        } catch { }
    } else {
        Write-Warn "El servidor respondió con código $($response.StatusCode)"
    }
} catch {
    Write-Warn "No se pudo conectar a $healthUrl"
    Write-Host "    $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "¿Continuar de todos modos? (s/n)"
    if ($continue -ne "s" -and $continue -ne "S") {
        Write-Err "Instalación cancelada por el usuario"
        exit 1
    }
}

# --- Guardar config.json ---
Write-Step "Guardando configuración..."
Write-IMBIOConfig -ServerUrl $ServerUrl -Mode "client"

# --- Resumen ---
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ IMBIO Cliente configurado correctamente" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Servidor:  $ServerUrl" -ForegroundColor White
Write-Host "  Config:    $Script:ConfigFile" -ForegroundColor White
Write-Host ""
Write-Host "  Para cambiar la URL del servidor más tarde:" -ForegroundColor White
Write-Host "    1. Abrir la app IMBIO" -ForegroundColor Gray
Write-Host "    2. Ir a Configuración → Modo de Operación" -ForegroundColor Gray
Write-Host "    O editar manualmente: $Script:ConfigFile" -ForegroundColor Gray
Write-Host ""

Write-Log "Cliente IMBIO configurado, servidor: $ServerUrl"
