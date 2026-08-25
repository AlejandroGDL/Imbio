# =================================================================
# common.ps1 — Funciones compartidas para los scripts de instalación
# =================================================================
# Este archivo NO se ejecuta solo. Se importa con `. .\common.ps1`
# desde install-server.ps1, install-client.ps1, uninstall.ps1
# =================================================================

# --- Configuración global ---
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"  # evita ruido con cmdlet nativos
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Constantes de rutas (se pueden sobreescribir con -InstallDir)
$Script:DefaultInstallDir = Join-Path $env:ProgramFiles "IMBIO"
$Script:ProgramDataDir    = Join-Path $env:ProgramData "IMBIO"
$Script:ConfigFile        = Join-Path $Script:ProgramDataDir "config.json"
$Script:LogsDir           = Join-Path $Script:ProgramDataDir "logs"
$Script:DataDir           = Join-Path $Script:ProgramDataDir "data"
$Script:PostgresDataDir   = Join-Path $Script:DataDir "postgresql"
$Script:PostgresBinDir    = ""  # se setea en runtime
$Script:NodeBinDir        = ""  # se setea en runtime
$Script:ServerDir         = ""  # se setea en runtime

# --- Colores para output (gris, verde, amarillo, rojo) ---
function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "▶ $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  ⚠ $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "  ✗ $Message" -ForegroundColor Red
}

# --- Generar string aleatorio (para JWT_SECRET, passwords, etc.) ---
function New-RandomSecret {
    param([int]$Length = 48)
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return [Convert]::ToHexString($bytes).ToLower()
}

# --- Generar password aleatorio (alfanumérico, para Postgres) ---
function New-RandomPassword {
    param([int]$Length = 24)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $result = ""
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    for ($i = 0; $i -lt $Length; $i++) {
        $bytes = New-Object byte[] 1
        $rng.GetBytes($bytes)
        $result += $chars[$bytes[0] % $chars.Length]
    }
    return $result
}

# --- Verificar que se ejecuta como Administrador ---
function Test-Administrator {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal(
        [Security.Principal.WindowsIdentity]::GetCurrent()
    )
    return $currentPrincipal.IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator
    )
}

# --- Verificar si un servicio existe ---
function Test-ServiceExists {
    param([string]$Name)
    $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
    return ($null -ne $svc)
}

# --- Esperar a que un puerto esté abierto (para el server) ---
function Wait-PortOpen {
    param(
        [string]$Host = "127.0.0.1",
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )
    Write-Host "  Esperando a que $Host`:$Port esté disponible..." -NoNewline
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.BeginConnect($Host, $Port, $null, $null) | Out-Null
            Start-Sleep -Milliseconds 100
            if ($tcp.Connected) {
                $tcp.Close()
                Write-Host " ✓" -ForegroundColor Green
                return $true
            }
            $tcp.Close()
        } catch {
            # seguir intentando
        }
        Start-Sleep -Milliseconds 500
        Write-Host "." -NoNewline
    }
    Write-Host " timeout" -ForegroundColor Red
    return $false
}

# --- Crear directorios estándar ---
function Initialize-IMBIODirectories {
    foreach ($dir in @($Script:ProgramDataDir, $Script:LogsDir, $Script:DataDir)) {
        if (-not (Test-Path $dir)) {
            New-Item -Path $dir -ItemType Directory -Force | Out-Null
        }
    }
}

# --- Escribir log a archivo (siempre, además de consola) ---
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $logFile = Join-Path $Script:LogsDir "install.log"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Add-Content -Path $logFile -Value $line
}

# --- Escribir config.json en ProgramData ---
# Esta es la "interfaz" entre el instalador y la app Tauri.
# La app Tauri lee este archivo al iniciar (ver src/lib/config.ts).
function Write-IMBIOConfig {
    param(
        [Parameter(Mandatory)] [string]$ServerUrl,
        [Parameter(Mandatory)] [ValidateSet("server", "client")] [string]$Mode
    )
    $config = @{
        serverUrl = $ServerUrl
        mode      = $Mode
    } | ConvertTo-Json -Depth 10
    Set-Content -Path $Script:ConfigFile -Value $config -Encoding UTF8
    Write-Ok "Configuración guardada en: $Script:ConfigFile"
    Write-Ok "  serverUrl: $ServerUrl"
    Write-Ok "  mode:      $Mode"
}
