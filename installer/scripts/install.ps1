# install.ps1 - PASO 2 FIX: log super basico

# Crear el log con la tecnica mas basica posible
# Sin funciones, sin try/catch, sin nada raro
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logLine = "${ts} [TEST] script started"

# Crear carpeta con mkdir -Force (idempotente)
mkdir "C:\ProgramData\IMBIO\logs" -Force | Out-Null

# Escribir con Add-Content (la tecnica mas compatible)
Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value $logLine

Write-Host "TEST: escribio primera linea" -ForegroundColor Green
Write-Host "Log: C:\ProgramData\IMBIO\logs\install.log" -ForegroundColor Gray
Write-Host "TimeStamp: $ts" -ForegroundColor Gray
Write-Host ""

# Ahora si, continuar con el bundle
$bundleZip = "C:\Program Files\IMBIO\resources\server-bundle.zip"
$serverDir = "C:\Program Files\IMBIO\server"

if (-not (Test-Path $bundleZip)) {
    Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [FATAL] server-bundle.zip no existe"
    Write-Host "  ✗ server-bundle.zip NO existe" -ForegroundColor Red
    Write-Host ""
    Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [INFO] bundleZip existe, tamano: $((Get-Item $bundleZip).Length)"

Write-Host "  ✓ server-bundle.zip existe ($([math]::Round((Get-Item $bundleZip).Length / 1MB, 1)) MB)" -ForegroundColor Green

# Verificar si ya esta descomprimido
$markerFile = Join-Path $serverDir "dist\index.js"
if (Test-Path $markerFile) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [INFO] Bundle ya descomprimido"
    Write-Host "  ✓ Bundle ya descomprimido" -ForegroundColor Green
    Write-Host ""
    Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [INFO] Iniciando descompresion con ZipFile"

Write-Host ""
Write-Host "▶ Descomprimiendo bundle (puede tardar 1-2 min)..." -ForegroundColor Cyan

# Limpiar serverDir
if (Test-Path $serverDir) {
    Remove-Item -Path $serverDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -Path $serverDir -ItemType Directory -Force | Out-Null

# Usar ZipFile directo (sin problemas de path)
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [INFO] ZipFile assembly cargada"

    $zip = [System.IO.Compression.ZipFile]::OpenRead($bundleZip)
    Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [INFO] Zip abierto, entries: $($zip.Entries.Count)"

    $count = 0
    foreach ($entry in $zip.Entries) {
        $count++
        $destPath = Join-Path $serverDir $entry.FullName
        if ($entry.FullName.EndsWith("/")) {
            if (-not (Test-Path $destPath)) {
                New-Item -Path $destPath -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
            }
        } else {
            $destDir = Split-Path -Parent $destPath
            if (-not (Test-Path $destDir)) {
                New-Item -Path $destDir -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
            }
            $out = [System.IO.File]::Create($destPath)
            try {
                $entryStream = $entry.Open()
                $entryStream.CopyTo($out)
            } finally {
                $out.Close()
                $entryStream.Close()
            }
        }
    }
    $zip.Close()
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [INFO] Descompresion completa, $count entries"
    Write-Host "  ✓ $count archivos extraidos" -ForegroundColor Green
} catch {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $err = $_.Exception.Message
    Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [FATAL] Error: $err"
    Write-Host "  ✗ Error: $err" -ForegroundColor Red
    Write-Host ""
    Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Verificar
if (Test-Path $markerFile) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $nodeModulesCount = (Get-ChildItem -Path (Join-Path $serverDir "node_modules") -Directory -ErrorAction SilentlyContinue).Count
    Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [INFO] dist/index.js existe, $nodeModulesCount paquetes"
    Write-Host "  ✓ dist/index.js existe ($nodeModulesCount paquetes)" -ForegroundColor Green
} else {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [FATAL] dist/index.js NO existe"
    Write-Host "  ✗ dist/index.js NO existe" -ForegroundColor Red
    Write-Host ""
    Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path "C:\ProgramData\IMBIO\logs\install.log" -Value "${ts} [DONE] Paso 2 OK"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Paso 2 completado" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
