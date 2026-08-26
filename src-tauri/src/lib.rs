// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Devuelve la configuración que el instalador dejó en disco.
/// Esto evita que el usuario tenga que configurar la URL del servidor
/// cada vez que abre la app.
///
/// Busca en este orden:
///   1. %ProgramData%\IMBIO\config.json  (config global, puesta por el instalador)
///   2. %APPDATA%\IMBIO\config.json      (config de usuario, override)
///
/// Si no encuentra nada, devuelve null (la app usa localStorage como
/// antes).
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

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct InstallConfig {
    server_url: String,
    mode: String,
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
        .invoke_handler(tauri::generate_handler![greet, get_install_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
