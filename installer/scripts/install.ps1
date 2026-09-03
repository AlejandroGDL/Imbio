# install.ps1 - PASO 2: log + descomprimir bundle

$logFile = "C:\ProgramData\IMBIO\logs\install.log"
$logDir  = "C:\ProgramData\IMBIO\logs"

if (-not (Test-Path $logDir)) {
    New-Item -Path $logDir -ItemType Directory -Force | Out-Null
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[${ts}] [STEP 2] Script iniciado" | Out-File -FilePath $logFile -Encoding UTF8 -Append

function Log {
    param($msg)
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg" | Out-File -FilePath $logFile -Encoding UTF8 -Append
}

Write-Host "PASO 2: Descomprimir bundle del servidor" -ForegroundColor Cyan
Write-Host "Log: $logFile" -ForegroundColor Gray
Write-Host ""

# Parsear argumentos
$Mode = $null
$InstallDir = $null
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq "-Mode") { $Mode = $args[$i + 1]; $i++ }
    if ($args[$i] -eq "-InstallDir") { $InstallDir = $args[$i + 1]; $i++ }
}

Log "[INFO] Args: Mode=$Mode, InstallDir=$InstallDir"
Write-Host "Mode: $Mode" -ForegroundColor White
Write-Host "InstallDir: $InstallDir" -ForegroundColor White
Write-Host ""

# Validar InstallDir
if ([string]::IsNullOrEmpty($InstallDir)) {
    Log "[FATAL] InstallDir vacio"
    Write-Host "  ✗ InstallDir vacio" -ForegroundColor Red
    Write-Host ""
    Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

if (-not (Test-Path $InstallDir)) {
    Log "[FATAL] InstallDir no existe: $InstallDir"
    Write-Host "  ✗ InstallDir no existe: $InstallDir" -ForegroundColor Red
    Write-Host ""
    Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# ==== PASO 2: Descomprimir server-bundle.zip ====
$bundleZip = Join-Path $InstallDir "resources\server-bundle.zip"
$serverDir = Join-Path $InstallDir "server"

Log "[STEP 2] Descomprimiendo server-bundle.zip"
Log "[INFO] bundleZip: $bundleZip"
Log "[INFO] serverDir: $serverDir"

if (-not (Test-Path $bundleZip)) {
    Log "[FATAL] server-bundle.zip no encontrado"
    Write-Host "  ✗ server-bundle.zip no encontrado en: $bundleZip" -ForegroundColor Red
    Write-Host ""
    Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Log "[INFO] bundleZip existe, tamano: $((Get-Item $bundleZip).Length) bytes"

$markerFile = Join-Path $serverDir "dist\index.js"
if (Test-Path $markerFile) {
    Log "[INFO] Bundle ya descomprimido (dist/index.js existe)"
    Write-Host "  ✓ Bundle ya descomprimido" -ForegroundColor Green
} else {
    Log "[INFO] Iniciando descompresion con ZipFile directo"
    Write-Host "▶ Descomprimiendo bundle..." -ForegroundColor Cyan
    Write-Host "  (esto puede tardar 1-2 minutos)" -ForegroundColor Gray

    # Limpiar serverDir si existe
    if (Test-Path $serverDir) {
        Log "[INFO] Limpiando $serverDir"
        Remove-Item -Path $serverDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -Path $serverDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
    Log "[INFO] serverDir recreado"

    # Usar System.IO.Compression.ZipFile directo
    # (Expand-Archive falla con paths > 260 chars en PS 5.1)
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        Log "[INFO] ZipFile assembly cargada"
    } catch {
        Log "[FATAL] No se pudo cargar ZipFile: $($_.Exception.Message)"
        Write-Host "  ✗ Error cargando ZipFile: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }

    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($bundleZip)
        Log "[INFO] Zip abierto, entries: $($zip.Entries.Count)"
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
        Log "[INFO] Descompresion completa, $count entries procesados"
    } catch {
        $err = "Error descomprimiendo: $($_.Exception.Message)"
        Log "[FATAL] $err"
        Write-Host "  ✗ $err" -ForegroundColor Red
        Write-Host ""
        Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }

    # Verificar que descomprimió OK
    if (Test-Path $markerFile) {
        Log "[INFO] Verificacion OK: $markerFile existe"
        $nodeModulesCount = (Get-ChildItem -Path (Join-Path $serverDir "node_modules") -Directory -ErrorAction SilentlyContinue).Count
        Log "[INFO] node_modules tiene $nodeModulesCount carpetas"
        Write-Host "  ✓ Bundle descomprimido OK ($nodeModulesCount paquetes)" -ForegroundColor Green
    } else {
        Log "[FATAL] No se encontro $markerFile despues de descomprimir"
        Write-Host "  ✗ No se encontro dist/index.js despues de descomprimir" -ForegroundColor Red
        Write-Host ""
        Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

Log "[DONE] Paso 2 completado OK"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Paso 2 completado: bundle descomprimido" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
