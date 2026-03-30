use vfs::{LocalVfs, Vfs, VPath, Entry, Metadata};
use tauri::State;
use crate::AppState;

#[tauri::command]
pub async fn cmd_list_dir(path: String) -> Result<Vec<Entry>, String> {
    let vfs = LocalVfs;
    vfs.list(&VPath::new(path)).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_read_file_text(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path).await
        .map_err(|e| format!("Cannot read file '{path}': {e}"))
}

#[tauri::command]
pub async fn cmd_stat(path: String) -> Result<Metadata, String> {
    let vfs = LocalVfs;
    vfs.stat(&VPath::new(path)).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_copy_file(src: String, dst: String) -> Result<(), String> {
    // Ensure parent dir exists
    if let Some(parent) = std::path::Path::new(&dst).parent() {
        tokio::fs::create_dir_all(parent).await
            .map_err(|e| format!("mkdir failed: {e}"))?;
    }
    tokio::fs::copy(&src, &dst).await
        .map_err(|e| format!("Copy failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn cmd_delete_path(path: String, recursive: bool) -> Result<(), String> {
    let vfs = LocalVfs;
    vfs.delete(&VPath::new(path), recursive).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Cannot read '{path}': {e}"))
}

#[tauri::command]
pub async fn cmd_rename_path(src: String, dst: String) -> Result<(), String> {
    let vfs = LocalVfs;
    vfs.rename(&VPath::new(src), &VPath::new(dst)).await.map_err(|e| e.to_string())
}
