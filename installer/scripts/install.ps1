# =================================================================
# install.ps1 - VERSION TEST ULTRA MINIMAL
# =================================================================
# Solo para confirmar que el script se ejecuta y el log se crea.
# Si esto funciona, el problema era el contenido del script completo.
# =================================================================

# NO usar [CmdletBinding()] ni param() por ahora para evitar
# errores de sintaxis raros en PowerShell 5.1

# ==== CREAR LOG EN LA PRIMERA LÍNEA ====
$logFile = "C:\ProgramData\IMBIO\logs\install.log"
$logDir  = "C:\ProgramData\IMBIO\logs"

# Crear carpeta con fallback a TEMP
$logWritten = $false
try {
    if (-not (Test-Path $logDir)) {
        New-Item -Path $logDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
    }
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INIT] Script INICIADO (version TEST)" | Out-File -FilePath $logFile -Encoding UTF8 -Append
    $logWritten = $true
} catch {
    # Fallback a TEMP
    $logFile = Join-Path $env:TEMP "imbio-install.log"
    $logDir = Split-Path -Parent $logFile
    try {
        if (-not (Test-Path $logDir)) { New-Item -Path $logDir -ItemType Directory -Force | Out-Null }
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INIT] Script INICIADO (fallback TEMP)" | Out-File -FilePath $logFile -Encoding UTF8 -Append
        $logWritten = $true
    } catch {
        # Si nada funciona, el log no se podrá crear
    }
}

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMBIO Setup (VERSION TEST)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Log file: $logFile" -ForegroundColor Gray
Write-Host "  Log written: $logWritten" -ForegroundColor Gray
Write-Host ""

# Parsear argumentos manualmente (sin param/CmdletBinding)
$Mode = $null
$InstallDir = $null
$ServerUrl = $null
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq "-Mode" -and $i + 1 -lt $args.Count) {
        $Mode = $args[$i + 1]
        $i++
    } elseif ($args[$i] -eq "-InstallDir" -and $i + 1 -lt $args.Count) {
        $InstallDir = $args[$i + 1]
        $i++
    } elseif ($args[$i] -eq "-ServerUrl" -and $i + 1 -lt $args.Count) {
        $ServerUrl = $args[$i + 1]
        $i++
    }
}

if ($logWritten) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INFO] Args: Mode=$Mode, InstallDir=$InstallDir, ServerUrl=$ServerUrl" | Out-File -FilePath $logFile -Encoding UTF8 -Append
}

Write-Host "  Mode:       $Mode" -ForegroundColor White
Write-Host "  InstallDir: $InstallDir" -ForegroundColor White
Write-Host ""

# Verificaciones básicas
if ($logWritten) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INFO] InstallDir existe: $(Test-Path $InstallDir)" | Out-File -FilePath $logFile -Encoding UTF8 -Append
    $resourcesDir = Join-Path $InstallDir "resources"
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INFO] resourcesDir existe: $(Test-Path $resourcesDir)" | Out-File -FilePath $logFile -Encoding UTF8 -Append
    $bundleZip = Join-Path $InstallDir "resources\server-bundle.zip"
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INFO] bundle existe: $(Test-Path $bundleZip)" | Out-File -FilePath $logFile -Encoding UTF8 -Append
    $commonPath = Join-Path $InstallDir "resources\common.ps1"
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INFO] common.ps1 existe: $(Test-Path $commonPath)" | Out-File -FilePath $logFile -Encoding UTF8 -Append
}

Write-Host "  InstallDir existe:       $(Test-Path $InstallDir)" -ForegroundColor $(if (Test-Path $InstallDir) {'Green'} else {'Red'})
Write-Host "  resources/ existe:       $(Test-Path (Join-Path $InstallDir 'resources'))" -ForegroundColor $(if (Test-Path (Join-Path $InstallDir 'resources')) {'Green'} else {'Red'})
Write-Host "  common.ps1 existe:       $(Test-Path (Join-Path $InstallDir 'resources\common.ps1'))" -ForegroundColor $(if (Test-Path (Join-Path $InstallDir 'resources\common.ps1')) {'Green'} else {'Red'})
Write-Host "  server-bundle.zip existe: $(Test-Path (Join-Path $InstallDir 'resources\server-bundle.zip'))" -ForegroundColor $(if (Test-Path (Join-Path $InstallDir 'resources\server-bundle.zip')) {'Green'} else {'Red'})
Write-Host ""

# Listar archivos en resources
$resourcesDir = Join-Path $InstallDir "resources"
if (Test-Path $resourcesDir) {
    Write-Host "  Archivos en resources/:" -ForegroundColor Yellow
    Get-ChildItem $resourcesDir | ForEach-Object {
        Write-Host "    - $($_.Name) ($([math]::Round($_.Length / 1KB, 1)) KB)" -ForegroundColor Gray
    }
}

# Pausa para que veas el resultado
Write-Host ""
Write-Host "  Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
