# =================================================================
# diagnose.ps1 — Diagnóstico rápido de instalación IMBIO
# =================================================================
# Ejecuta esto y pega la salida. Te diré exactamente qué falla.
# Uso:
#   powershell -ExecutionPolicy Bypass -File diagnose.ps1
# =================================================================

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMBIO — Diagnóstico de instalación" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# --- 1. Servicios de Windows ---
Write-Host "▶ 1. Servicios de Windows instalados:" -ForegroundColor Yellow
foreach ($svc in @("ImbioServer", "ImbioPostgreSQL")) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($null -eq $s) {
        Write-Host "  ✗ $svc : NO EXISTE" -ForegroundColor Red
    } else {
        $color = if ($s.Status -eq "Running") { "Green" } else { "Red" }
        Write-Host "  $($s.Status) $svc (StartType: $($s.StartType))" -ForegroundColor $color
    }
}
Write-Host ""

# --- 2. Archivos en disco ---
Write-Host "▶ 2. Archivos en disco:" -ForegroundColor Yellow
$installDir = Join-Path $env:ProgramFiles "IMBIO"
$resourcesDir = Join-Path $installDir "resources"
$serverDir = Join-Path $installDir "server"
$nodeDir = Join-Path $installDir "node"
$pgsqlDir = Join-Path $installDir "pgsql"
$nssm = Join-Path $installDir "nssm.exe"

Write-Host "  InstallDir: $installDir"
Write-Host "  IMBIO.exe: $(if (Test-Path "$installDir\IMBIO.exe") {'✓ existe'} else {'✗ NO EXISTE'})"
Write-Host "  nssm.exe:  $(if (Test-Path $nssm) {'✓ existe'} else {'✗ NO EXISTE'})"
Write-Host "  node\:     $(if (Test-Path "$nodeDir\node.exe") {'✓ existe'} else {'✗ NO EXISTE'})"
Write-Host "  pgsql\:    $(if (Test-Path "$pgsqlDir\bin\pg_ctl.exe") {'✓ existe'} else {'✗ NO EXISTE'})"
Write-Host "  server\:   $(if (Test-Path "$serverDir\dist\index.js") {'✓ existe'} else {'✗ NO EXISTE'})"
Write-Host "  .env:      $(if (Test-Path "$serverDir\.env") {'✓ existe'} else {'✗ NO EXISTE'})"
Write-Host ""

# --- 3. Resources del instalador (los PS que Tauri mete) ---
Write-Host "▶ 3. Resources del instalador (scripts PowerShell):" -ForegroundColor Yellow
foreach ($f in @("install.ps1", "install-server.ps1", "install-client.ps1", "uninstall.ps1", "common.ps1", "download-binaries.ps1")) {
    $p = Join-Path $resourcesDir $f
    if (Test-Path $p) {
        Write-Host "  ✓ resources\$f" -ForegroundColor Green
    } else {
        Write-Host "  ✗ resources\$f : NO EXISTE" -ForegroundColor Red
    }
}
Write-Host ""

# --- 4. Configuración del instalador ---
Write-Host "▶ 4. Configuración:" -ForegroundColor Yellow
$configFile = Join-Path $env:ProgramData "IMBIO\config.json"
if (Test-Path $configFile) {
    Write-Host "  ✓ $configFile" -ForegroundColor Green
    Get-Content $configFile | ForEach-Object { Write-Host "    $_" }
} else {
    Write-Host "  ✗ $configFile : NO EXISTE" -ForegroundColor Red
}
Write-Host ""

# --- 5. Logs ---
Write-Host "▶ 5. Logs disponibles:" -ForegroundColor Yellow
$logsDir = Join-Path $env:ProgramData "IMBIO\logs"
if (Test-Path $logsDir) {
    Get-ChildItem $logsDir -File | ForEach-Object {
        $size = [math]::Round($_.Length / 1KB, 1)
        Write-Host "  $($_.Name) ($size KB)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ✗ $logsDir : NO EXISTE (los hooks NSIS probablemente no se ejecutaron)" -ForegroundColor Red
}
Write-Host ""

# --- 6. Puerto 3000 ---
Write-Host "▶ 6. Puerto 3000 (IMBIO server):" -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    foreach ($p in $port3000) {
        Write-Host "  Puerto 3000: $($p.State) - Proceso: $($p.OwningProcess)" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ Puerto 3000 NO está abierto" -ForegroundColor Red
}
Write-Host ""

# --- 7. Puerto 5432 ---
Write-Host "▶ 7. Puerto 5432 (PostgreSQL):" -ForegroundColor Yellow
$port5432 = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
if ($port5432) {
    foreach ($p in $port5432) {
        Write-Host "  Puerto 5432: $($p.State) - Proceso: $($p.OwningProcess)" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ Puerto 5432 NO está abierto" -ForegroundColor Red
}
Write-Host ""

# --- 8. Tail del log de instalación (si existe) ---
Write-Host "▶ 8. Últimas 30 líneas de install.log:" -ForegroundColor Yellow
$installLog = Join-Path $logsDir "install.log"
if (Test-Path $installLog) {
    Get-Content $installLog -Tail 30 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "  ✗ No existe install.log" -ForegroundColor Red
}
Write-Host ""

# --- 9. Tail del log del server (si existe) ---
Write-Host "▶ 9. Últimas 20 líneas de server.log:" -ForegroundColor Yellow
$serverLog = Join-Path $logsDir "server.log"
if (Test-Path $serverLog) {
    Get-Content $serverLog -Tail 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "  No existe server.log (el server nunca arrancó)" -ForegroundColor Gray
}
Write-Host ""

# --- 10. Procesos Node/PgSQL corriendo ---
Write-Host "▶ 10. Procesos IMBIO corriendo:" -ForegroundColor Yellow
$procs = Get-Process | Where-Object {
    $_.ProcessName -like "*node*" -or
    $_.ProcessName -like "*postgres*" -or
    ($_.Path -like "*IMBIO*")
}
if ($procs) {
    foreach ($p in $procs) {
        Write-Host "  $($p.ProcessName) (PID $($p.Id)) - Path: $($p.Path)" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ No hay procesos de Node/Postgres/IMBIO corriendo" -ForegroundColor Red
}
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  FIN del diagnóstico" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si los hooks NSIS no se ejecutaron, lo más probable es que:" -ForegroundColor Gray
Write-Host "  1. La versión de Tauri no soporta installerHooks, o" -ForegroundColor Gray
Write-Host "  2. El archivo installer-hooks.nsh tiene un error de sintaxis" -ForegroundColor Gray
Write-Host "  3. tauri.conf.json apunta mal al archivo" -ForegroundColor Gray
