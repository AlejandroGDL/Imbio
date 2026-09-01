// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Devuelve la configuración que el instalador dejó en disco.
/// Si no existe, devuelve null (la app mostrará un wizard de setup).
#[tauri::command]
fn get_install_config() -> Option<InstallConfig> {
    let candidates = [
        program_data_path("IMBIO", "config.json"),
        app_data_path("IMBIO", "config.json"),
    ];

    for path in candidates.iter().flatten() {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(cfg) = serde_json::from_str::<InstallConfig>(&content) {
                eprintln!("[IMBIO] Config leída de: {}", path.display());
                return Some(cfg);
            }
        }
    }
    None
}

/// Devuelve true si IMBIO necesita configuración inicial
/// (no existe config.json y la app debe mostrar el wizard de setup).
#[tauri::command]
fn needs_setup() -> bool {
    get_install_config().is_none()
}

/// Ejecuta el script de setup de IMBIO en una ventana VISIBLE de PowerShell.
/// Devuelve true si terminó con exit code 0, false si falló.
///
/// El script se invoca con `-Mode <mode>`, donde `mode` es "server" o "client".
/// Si es "client", se pasa también `-ServerUrl <url>`.
#[tauri::command]
fn run_setup(mode: String, server_url: Option<String>) -> SetupResult {
    eprintln!("[IMBIO] run_setup() mode={}, serverUrl={:?}", mode, server_url);

    // Buscar el script install.ps1 junto al ejecutable
    // Tauri pone el exe en $INSTDIR/IMBIO.exe y los resources en $INSTDIR/resources/
    let exe_path = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    let install_dir = exe_path.parent().unwrap_or(std::path::Path::new("."));
    let script_path = install_dir.join("resources").join("install.ps1");

    eprintln!("[IMBIO] install.ps1: {}", script_path.display());

    if !script_path.exists() {
        return SetupResult {
            success: false,
            exit_code: -1,
            stdout: String::new(),
            stderr: format!("No se encontró install.ps1 en {}", script_path.display()),
        };
    }

    // Construir el comando PowerShell
    let mut args: Vec<String> = vec![
        "-NoProfile".to_string(),
        "-ExecutionPolicy".to_string(),
        "Bypass".to_string(),
        "-File".to_string(),
        script_path.to_string_lossy().to_string(),
        "-Mode".to_string(),
        mode.clone(),
        "-InstallDir".to_string(),
        install_dir.to_string_lossy().to_string(),
    ];

    if let Some(url) = &server_url {
        args.push("-ServerUrl".to_string());
        args.push(url.clone());
    }

    eprintln!("[IMBIO] Ejecutando: powershell.exe {}", args.join(" "));

    // Ejecutar PowerShell en una ventana VISIBLE
    // Usamos cmd /c start para que abra una ventana separada y visible
    #[cfg(target_os = "windows")]
    {
        // cmd /c start "titulo" powershell.exe -NoProfile ...
        // "start" abre una ventana nueva y devuelve el control inmediatamente
        // La ventana queda abierta aunque el script termine
        let mut start_args: Vec<String> = vec![
            "/c".to_string(),
            "start".to_string(),
            "IMBIO Setup".to_string(), // título de la ventana
            "/WAIT".to_string(),       // esperar a que termine
            "powershell.exe".to_string(),
        ];
        start_args.extend(args);

        let result = Command::new("cmd.exe").args(&start_args).spawn();

        match result {
            Ok(mut child) => {
                match child.wait() {
                    Ok(status) => {
                        let code = status.code().unwrap_or(-1);
                        SetupResult {
                            success: status.success(),
                            exit_code: code,
                            stdout: String::new(),
                            stderr: if !status.success() {
                                format!("PowerShell termino con codigo {}", code)
                            } else {
                                String::new()
                            },
                        }
                    }
                    Err(e) => SetupResult {
                        success: false,
                        exit_code: -1,
                        stdout: String::new(),
                        stderr: format!("Error esperando cmd: {}", e),
                    },
                }
            }
            Err(e) => SetupResult {
                success: false,
                exit_code: -1,
                stdout: String::new(),
                stderr: format!("Error ejecutando cmd: {}", e),
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // En Mac/Linux no aplica (esto es solo para Windows)
        SetupResult {
            success: false,
            exit_code: -1,
            stdout: String::new(),
            stderr: "IMBIO solo se ejecuta en Windows".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct InstallConfig {
    server_url: String,
    mode: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SetupResult {
    success: bool,
    exit_code: i32,
    stdout: String,
    stderr: String,
}

fn program_data_path(app: &str, file: &str) -> Option<PathBuf> {
    std::env::var_os("ProgramData").map(|p| PathBuf::from(p).join(app).join(file))
}

fn app_data_path(app: &str, file: &str) -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|p| PathBuf::from(p).join(app).join(file))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_install_config,
            needs_setup,
            run_setup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
