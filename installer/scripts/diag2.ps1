# Diagnóstico post-instalación IMBIO
# Ejecutar como Administrador

$ErrorActionPreference = "Continue"
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMBIO - Diagnostico post-instalacion" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Carpeta ProgramData
Write-Host "1. C:\ProgramData\IMBIO existe?" -ForegroundColor Yellow
if (Test-Path "C:\ProgramData\IMBIO") {
    Write-Host "   SI - contenido:" -ForegroundColor Green
    Get-ChildItem "C:\ProgramData\IMBIO" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName | Format-Table -AutoSize
} else {
    Write-Host "   NO - el hook POSTINSTALL no se ejecuto" -ForegroundColor Red
}
Write-Host ""

# 2. Log de instalacion (lo que escribe el hook NSIS)
Write-Host "2. Log del hook NSIS:" -ForegroundColor Yellow
$hookLog = "C:\Program Files\IMBIO\logs\imbio-install.log"
if (Test-Path $hookLog) {
    Write-Host "   Existe - contenido:" -ForegroundColor Green
    Get-Content $hookLog | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "   NO existe - el hook NSIS no escribio log" -ForegroundColor Red
}
Write-Host ""

# 3. Log del PowerShell (lo que escribe install-server.ps1)
Write-Host "3. Logs de PowerShell:" -ForegroundColor Yellow
$psLogs = @(
    "C:\ProgramData\IMBIO\logs\install.log",
    "C:\ProgramData\IMBIO\logs\postgresql.log",
    "C:\ProgramData\IMBIO\logs\server.log"
)
foreach ($log in $psLogs) {
    if (Test-Path $log) {
        Write-Host "   $log - existe, primeras 30 lineas:" -ForegroundColor Green
        Get-Content $log -Tail 30 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
    } else {
        Write-Host "   $log - NO existe" -ForegroundColor Red
    }
    Write-Host ""
}

# 4. Verificar si se descargaron los binarios
Write-Host "4. Binarios descargados:" -ForegroundColor Yellow
$binarios = @(
    "C:\Program Files\IMBIO\node\node.exe",
    "C:\Program Files\IMBIO\pgsql\bin\pg_ctl.exe",
    "C:\Program Files\IMBIO\nssm.exe"
)
foreach ($b in $binarios) {
    if (Test-Path $b) {
        $size = [math]::Round((Get-Item $b).Length / 1MB, 1)
        Write-Host "   $b - $size MB" -ForegroundColor Green
    } else {
        Write-Host "   $b - NO existe" -ForegroundColor Red
    }
}
Write-Host ""

# 5. Services de Windows
Write-Host "5. Servicios de Windows:" -ForegroundColor Yellow
Get-Service | Where-Object {$_.Name -like "Imbio*"} | Format-Table Name, Status, StartType -AutoSize | Out-String | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
if (-not (Get-Service | Where-Object {$_.Name -like "Imbio*"})) {
    Write-Host "   Ningun servicio IMBIO instalado" -ForegroundColor Red
}
Write-Host ""

# 6. Event Viewer reciente
Write-Host "6. Eventos recientes relacionados:" -ForegroundColor Yellow
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=(Get-Date).AddHours(-2)} -MaxEvents 10 -ErrorAction SilentlyContinue |
    Where-Object { $_.Message -match "Imbio|MSIaio" } |
    Select-Object TimeCreated, LevelDisplayName, Message |
    Format-List | Out-String | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
Write-Host ""

# 7. Procesos
Write-Host "7. Procesos IMBIO corriendo:" -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -match "node|postgres" -or $_.Path -like "*IMBIO*" } | Select-Object ProcessName, Id, Path | Format-Table -AutoSize | Out-String | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
if (-not (Get-Process | Where-Object { $_.ProcessName -match "node|postgres" -or $_.Path -like "*IMBIO*" })) {
    Write-Host "   Ningun proceso IMBIO/Node/Postgres corriendo" -ForegroundColor Red
}
Write-Host ""

# 8. config.json
Write-Host "8. Configuracion:" -ForegroundColor Yellow
$cfg = "C:\ProgramData\IMBIO\config.json"
if (Test-Path $cfg) {
    Write-Host "   Existe:" -ForegroundColor Green
    Get-Content $cfg | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
} else {
    Write-Host "   NO existe" -ForegroundColor Red
}
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Copia todo este output y mandamelo" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
