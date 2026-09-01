# =================================================================
# download-binaries.ps1
# =================================================================
# Descarga Node.js, PostgreSQL y nssm durante la instalación.
# Se ejecuta desde install.ps1 si los binarios no están presentes.
#
# Parámetros:
#   -InstallDir   Carpeta de instalación
#   -Components   Lista de componentes a descargar ("Node.js",
#                 "PostgreSQL", "nssm"). Si no se pasa, descarga todos.
# =================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string]$InstallDir,
    [string[]]$Components
)

if ($Components.Count -eq 0) {
    $Components = @("Node.js", "PostgreSQL", "nssm")
}

$ErrorActionPreference = "Stop"

# Importar funciones comunes (sin import de scripts que no existen aún)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptPath "common.ps1")

# Configuración
$NODE_VERSION = "v22.11.0"
$PG_VERSION   = "16.4"
$PG_BUILD     = "1"
$NSSM_VERSION = "2.24"

$NODE_URL = "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-win-x64.zip"
$PG_URL   = "https://get.enterprisedb.com/postgresql/postgresql-$PG_VERSION-$PG_BUILD-windows-x64-binaries.zip"
$NSSM_URL = "https://nssm.cc/release/nssm-$NSSM_VERSION.zip"

# Carpeta temporal en %TEMP%
$tmpDir = Join-Path $env:TEMP "imbio-installer-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
New-Item -Path $tmpDir -ItemType Directory -Force | Out-Null
Write-Host "  Carpeta temporal: $tmpDir" -ForegroundColor Gray

# Cleanup al salir
$cleanup = {
    if (Test-Path $tmpDir) {
        Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Register-EngineEvent -SourceIdentifier "PowerShell.Exiting" -Action $cleanup | Out-Null

# --- Funciones auxiliares ---
function Download-File {
    param(
        [string]$Url,
        [string]$Destination
    )
    Write-Host "  Descargando $Url" -ForegroundColor Gray
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 300
        $size = (Get-Item $Destination).Length
        Write-Host "    ✓ $([math]::Round($size / 1MB, 1)) MB" -ForegroundColor Green
    }
    catch {
        Write-Err "Falló la descarga de $Url"
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Gray
        throw
    }
}

function Expand-Zip {
    param(
        [string]$ZipPath,
        [string]$Destination
    )
    Write-Host "  Descomprimiendo $ZipPath..." -ForegroundColor Gray
    try {
        if (Test-Path $Destination) {
            Remove-Item -Path $Destination -Recurse -Force
        }
        New-Item -Path $Destination -ItemType Directory -Force | Out-Null
        Expand-Archive -Path $ZipPath -DestinationPath $Destination -Force
        Write-Host "    ✓" -ForegroundColor Green
    }
    catch {
        Write-Err "Falló la descompresión de $ZipPath"
        throw
    }
}

# --- 1. Node.js ---
if ($Components -contains "Node.js") {
    Write-Host ""
    Write-Host "▶ Node.js portable ($NODE_VERSION)" -ForegroundColor Cyan
    $nodeDest = Join-Path $InstallDir "node"
    if (Test-Path "$nodeDest\node.exe") {
        Write-Host "  ✓ Ya está instalado" -ForegroundColor Green
    } else {
        $nodeZip = Join-Path $tmpDir "node.zip"
        Download-File -Url $NODE_URL -Destination $nodeZip
        $nodeExtract = Join-Path $tmpDir "node-extract"
        Expand-Zip -ZipPath $nodeZip -Destination $nodeExtract

        # El zip contiene un subdirectorio "node-v22.x.x-win-x64/"
        $nodeSubdir = Get-ChildItem -Path $nodeExtract -Directory | Select-Object -First 1
        if ($null -eq $nodeSubdir) {
            throw "Estructura inesperada en el zip de Node.js"
        }
        if (Test-Path $nodeDest) { Remove-Item -Path $nodeDest -Recurse -Force }
        Move-Item -Path $nodeSubdir.FullName -Destination $nodeDest
        Write-Host "  ✓ Instalado en: $nodeDest" -ForegroundColor Green
    }
}

# --- 2. PostgreSQL ---
if ($Components -contains "PostgreSQL") {
    Write-Host ""
    Write-Host "▶ PostgreSQL $PG_VERSION (binarios)" -ForegroundColor Cyan
    $pgDest = Join-Path $InstallDir "pgsql"
    if (Test-Path "$pgDest\bin\pg_ctl.exe") {
        Write-Host "  ✓ Ya está instalado" -ForegroundColor Green
    } else {
        $pgZip = Join-Path $tmpDir "postgres.zip"
        Download-File -Url $PG_URL -Destination $pgZip
        $pgExtract = Join-Path $tmpDir "pg-extract"
        Expand-Zip -ZipPath $pgZip -Destination $pgExtract

        # El zip contiene un subdirectorio "pgsql/" con todo adentro
        $pgSubdir = Join-Path $pgExtract "pgsql"
        if (-not (Test-Path $pgSubdir)) {
            # A veces la estructura varía
            $pgSubdir = Get-ChildItem -Path $pgExtract -Directory | Select-Object -First 1
        }
        if ($null -eq $pgSubdir) {
            throw "Estructura inesperada en el zip de PostgreSQL"
        }
        if (Test-Path $pgDest) { Remove-Item -Path $pgDest -Recurse -Force }
        Move-Item -Path $pgSubdir.FullName -Destination $pgDest
        Write-Host "  ✓ Instalado en: $pgDest" -ForegroundColor Green
    }
}

# --- 3. nssm ---
if ($Components -contains "nssm") {
    Write-Host ""
    Write-Host "▶ nssm $NSSM_VERSION (Service Manager)" -ForegroundColor Cyan
    $nssmDest = Join-Path $InstallDir "nssm.exe"
    if (Test-Path $nssmDest) {
        Write-Host "  ✓ Ya está instalado" -ForegroundColor Green
    } else {
        $nssmZip = Join-Path $tmpDir "nssm.zip"
        Download-File -Url $NSSM_URL -Destination $nssmZip
        $nssmExtract = Join-Path $tmpDir "nssm-extract"
        Expand-Zip -ZipPath $nssmZip -Destination $nssmExtract
        # nssm-2.24/win64/nssm.exe
        $nssmExeSrc = Get-ChildItem -Path $nssmExtract -Recurse -Filter "nssm.exe" |
                      Where-Object { $_.DirectoryName -like "*win64*" } |
                      Select-Object -First 1
        if ($null -eq $nssmExeSrc) {
            throw "No se encontró nssm.exe (win64) en el zip"
        }
        Copy-Item -Path $nssmExeSrc.FullName -Destination $nssmDest -Force
        Write-Host "  ✓ Instalado en: $nssmDest" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "  ✅ Binarios descargados" -ForegroundColor Green

# Cleanup
Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
