# install.ps1 - PASO 1: solo crear log

$logFile = "C:\ProgramData\IMBIO\logs\install.log"
$logDir  = "C:\ProgramData\IMBIO\logs"

if (-not (Test-Path $logDir)) {
    New-Item -Path $logDir -ItemType Directory -Force | Out-Null
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[${ts}] [STEP 1] Script iniciado" | Out-File -FilePath $logFile -Encoding UTF8 -Append

Write-Host "PASO 1: Script iniciado" -ForegroundColor Cyan
Write-Host "Log: $logFile" -ForegroundColor Gray

# Parsear argumentos
$Mode = $null
$InstallDir = $null
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq "-Mode") { $Mode = $args[$i + 1]; $i++ }
    if ($args[$i] -eq "-InstallDir") { $InstallDir = $args[$i + 1]; $i++ }
}

"[${ts}] [INFO] Mode=$Mode, InstallDir=$InstallDir" | Out-File -FilePath $logFile -Encoding UTF8 -Append

Write-Host "Mode: $Mode" -ForegroundColor White
Write-Host "InstallDir: $InstallDir" -ForegroundColor White
Write-Host ""

if ($Mode -eq "server") {
    Write-Host "OK - Modo servidor seleccionado" -ForegroundColor Green
    "[${ts}] [INFO] Modo servidor OK" | Out-File -FilePath $logFile -Encoding UTF8 -Append
} elseif ($Mode -eq "client") {
    Write-Host "OK - Modo cliente seleccionado" -ForegroundColor Green
    "[${ts}] [INFO] Modo cliente OK" | Out-File -FilePath $logFile -Encoding UTF8 -Append
} else {
    Write-Host "ERROR: Modo desconocido: $Mode" -ForegroundColor Red
    "[${ts}] [FATAL] Modo desconocido: $Mode" | Out-File -FilePath $logFile -Encoding UTF8 -Append
}

"[${ts}] [DONE] Script terminado OK" | Out-File -FilePath $logFile -Encoding UTF8 -Append
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
