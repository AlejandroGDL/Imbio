# =================================================================
# uninstall.ps1
# =================================================================
# Desinstala IMBIO completamente. Se ejecuta desde el uninstaller
# del instalador NSIS, o manualmente.
#
# Qué hace:
#   1. Detiene y desinstala los servicios de Windows (ImbioServer, ImbioPostgreSQL)
#   2. Elimina la regla de firewall
#   3. Pregunta si quiere borrar también los datos (BD + .env)
#   4. Elimina config.json y logs (opcional)
#   5. Elimina el acceso directo del escritorio
#
# Parámetros:
#   -InstallDir   Carpeta de instalación (default: C:\Program Files\IMBIO)
#   -KeepData     Si es $true, no borra los datos (default: $false)
# =================================================================

[CmdletBinding()]
param(
    [string]$InstallDir,
    [bool]$KeepData = $false
)

# Importar funciones comunes
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptPath "common.ps1")

# --- Verificar administrador ---
if (-not (Test-Administrator)) {
    Write-Err "Este script debe ejecutarse como Administrador."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = $Script:DefaultInstallDir
}

$nssmExe = Join-Path $InstallDir "nssm.exe"

Write-Step "Desinstalando IMBIO..."

# --- 1. Detener y desinstalar servicios ---
foreach ($svcName in @("ImbioServer", "ImbioPostgreSQL")) {
    if (Test-ServiceExists $svcName) {
        Write-Host "  Deteniendo servicio '$svcName'..." -NoNewline
        Stop-Service -Name $svcName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host " ✓" -ForegroundColor Green

        Write-Host "  Desinstalando servicio '$svcName'..." -NoNewline
        if (Test-Path $nssmExe) {
            & $nssmExe stop $svcName 2>&1 | Out-Null
            & $nssmExe remove $svcName confirm 2>&1 | Out-Null
        } else {
            sc.exe delete $svcName 2>&1 | Out-Null
        }
        Write-Host " ✓" -ForegroundColor Green
    } else {
        Write-Warn "Servicio '$svcName' no existe, saltando"
    }
}

# --- 2. Eliminar regla de firewall ---
Write-Step "Eliminando regla de firewall..."
Get-NetFirewallRule -DisplayName "IMBIO *" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-NetFirewallRule -Name $_.Name
    Write-Ok "Regla eliminada: $($_.DisplayName)"
}

# --- 3. Preguntar si borrar datos ---
if (-not $KeepData) {
    Write-Host ""
    Write-Host "  ⚠ ¿Borrar también los datos de IMBIO?" -ForegroundColor Yellow
    Write-Host "    (Base de datos PostgreSQL, archivos subidos, .env)" -ForegroundColor Gray
    Write-Host "    (Los logs también se borrarán)" -ForegroundColor Gray
    $resp = Read-Host "    (s/n) [n]"
    if ($resp -eq "s" -or $resp -eq "S") {
        if (Test-Path $Script:ProgramDataDir) {
            Write-Host "  Borrando $Script:ProgramDataDir..." -NoNewline
            Remove-Item -Path $Script:ProgramDataDir -Recurse -Force
            Write-Host " ✓" -ForegroundColor Green
        }
    } else {
        Write-Warn "Datos conservados en $Script:ProgramDataDir"
        Write-Log "Datos conservados durante la desinstalación"
    }
}

# --- 4. Eliminar acceso directo del escritorio ---
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcuts = @(
    "IMBIO Server Manager.lnk",
    "IMBIO.lnk"
)
foreach ($s in $shortcuts) {
    $p = Join-Path $desktopPath $s
    if (Test-Path $p) {
        Remove-Item -Path $p -Force
        Write-Ok "Acceso directo eliminado: $s"
    }
}

# --- 5. Eliminar de Inicio (si lo hubiera) ---
$startMenuPath = [Environment]::GetFolderPath("StartMenu")
$imbioStart = Join-Path $startMenuPath "Programs\IMBIO"
if (Test-Path $imbioStart) {
    Remove-Item -Path $imbioStart -Recurse -Force
    Write-Ok "Entradas de menú Inicio eliminadas"
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ IMBIO desinstalado" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Para reinstalar, ejecuta el instalador de nuevo." -ForegroundColor White
Write-Host ""

Write-Log "IMBIO desinstalado"
