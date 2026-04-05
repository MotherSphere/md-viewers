// Empêche la console Windows en release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod markdown;

use serde::Serialize;
use std::path::PathBuf;
use tauri::{Emitter, Manager};

#[derive(Serialize)]
struct LoadedFile {
    content: String,
    html: String,
    file_path: String,
    file_name: String,
}

#[tauri::command]
fn render_markdown(content: String) -> String {
    markdown::render(&content)
}

#[tauri::command]
fn load_file(path: String) -> Result<LoadedFile, String> {
    let pb = PathBuf::from(&path);
    let content = std::fs::read_to_string(&pb)
        .map_err(|e| format!("Impossible de lire le fichier : {e}"))?;
    let html = markdown::render(&content);
    let file_name = pb
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    Ok(LoadedFile {
        content,
        html,
        file_path: path,
        file_name,
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![render_markdown, load_file])
        .setup(|app| {
            // Si un fichier a été passé en argument (double-clic Windows/Linux)
            let args: Vec<String> = std::env::args().skip(1).collect();
            if let Some(file_arg) = args.iter().find(|a| !a.starts_with("--")) {
                let pb = PathBuf::from(file_arg);
                if pb.is_file() {
                    if let Some(window) = app.get_webview_window("main") {
                        let path_str = pb.to_string_lossy().to_string();
                        // Attendre un peu que le frontend soit prêt
                        let win_clone = window.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(400));
                            let _ = win_clone.emit("open-file-path", path_str);
                        });
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Tauri");
}
