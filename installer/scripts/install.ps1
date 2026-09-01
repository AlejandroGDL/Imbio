# =================================================================
# install.ps1 - VERSION MINIMAL DE PRUEBA
# =================================================================
# Solo para verificar que el comando desde Rust llega aqui.
# Si esto escribe el log y sale con exit 0, el problema estaba
# en el contenido del script original (muy complejo).
# =================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateSet("server", "client")] [string]$Mode,
    [Parameter(Mandatory)] [string]$InstallDir,
    [string]$ServerUrl
)

# Crear log SIEMPRE - primera línea del script
$logFile = "C:\ProgramData\IMBIO\logs\install.log"
$logDir  = "C:\ProgramData\IMBIO\logs"

if (-not (Test-Path $logDir)) {
    New-Item -Path $logDir -ItemType Directory -Force | Out-Null
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$ts] [INIT] Script INICIADO. Mode=$Mode, InstallDir=$InstallDir, ServerUrl=$ServerUrl"

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMBIO Setup (VERSION DE PRUEBA)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Log: $logFile" -ForegroundColor Gray
Write-Host "  Mode: $Mode" -ForegroundColor Gray
Write-Host "  InstallDir: $InstallDir" -ForegroundColor Gray
Write-Host ""
Add-Content -Path $logFile -Value "[$ts] [INFO] Header mostrado OK"

# Probar acceso a InstallDir
Add-Content -Path $logFile -Value "[$ts] [INFO] InstallDir existe: $(Test-Path $InstallDir)"

# Probar acceso a los resources
$resourcesDir = Join-Path $InstallDir "resources"
Add-Content -Path $logFile -Value "[$ts] [INFO] resourcesDir: $resourcesDir"
Add-Content -Path $logFile -Value "[$ts] [INFO] resourcesDir existe: $(Test-Path $resourcesDir)"

if (Test-Path $resourcesDir) {
    Add-Content -Path $logFile -Value "[$ts] [INFO] Archivos en resources:"
    Get-ChildItem $resourcesDir | ForEach-Object {
        Add-Content -Path $logFile -Value "[$ts]   - $($_.Name)"
    }
}

# Probar acceso a common.ps1
$commonPath = Join-Path $resourcesDir "common.ps1"
Add-Content -Path $logFile -Value "[$ts] [INFO] commonPath: $commonPath"
Add-Content -Path $logFile -Value "[$ts] [INFO] common.ps1 existe: $(Test-Path $commonPath)"

if (Test-Path $commonPath) {
    Add-Content -Path $logFile -Value "[$ts] [INFO] Importando common.ps1..."
    try {
        . $commonPath
        Add-Content -Path $logFile -Value "[$ts] [INFO] common.ps1 importado OK"
    } catch {
        Add-Content -Path $logFile -Value "[$ts] [ERROR] common.ps1 fallo: $($_.Exception.Message)"
    }
} else {
    Add-Content -Path $logFile -Value "[$ts] [ERROR] common.ps1 NO EXISTE"
}

# Probar acceso al bundle
$bundleZip = Join-Path $InstallDir "resources\server-bundle.zip"
Add-Content -Path $logFile -Value "[$ts] [INFO] bundleZip: $bundleZip"
Add-Content -Path $logFile -Value "[$ts] [INFO] bundle existe: $(Test-Path $bundleZip)"

Write-Host ""
Write-Host "  Resumen:" -ForegroundColor Yellow
Write-Host "    InstallDir existe:       $(Test-Path $InstallDir)" -ForegroundColor White
Write-Host "    resourcesDir existe:     $(Test-Path $resourcesDir)" -ForegroundColor White
Write-Host "    common.ps1 existe:       $(Test-Path $commonPath)" -ForegroundColor White
Write-Host "    server-bundle.zip existe: $(Test-Path $bundleZip)" -ForegroundColor White
Write-Host ""
Write-Host "  Log completo en: $logFile" -ForegroundColor Cyan
Add-Content -Path $logFile -Value "[$ts] [DONE] Script terminado OK"

Write-Host ""
Write-Host "  Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
