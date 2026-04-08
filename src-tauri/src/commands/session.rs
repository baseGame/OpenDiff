use session::{Session, AppSettings};
use tauri::State;
use crate::AppState;

#[tauri::command]
pub async fn cmd_list_recent_sessions(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<Session>, String> {
    let mgr = state.session_manager.lock().await;
    mgr.list_recent(limit.unwrap_or(10))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_save_session(
    state: State<'_, AppState>,
    session: Session,
) -> Result<(), String> {
    let mgr = state.session_manager.lock().await;
    mgr.save(&session).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_session(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let mgr = state.session_manager.lock().await;
    mgr.delete(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let mgr = state.session_manager.lock().await;
    mgr.get_settings().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_save_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), String> {
    let mgr = state.session_manager.lock().await;
    mgr.save_settings(&settings).await.map_err(|e| e.to_string())
}

/// Export ALL sessions as a single JSON file
#[tauri::command]
pub async fn cmd_export_all_sessions(state: State<'_, AppState>) -> Result<String, String> {
    let mgr = state.session_manager.lock().await;
    let sessions = mgr.list_recent(1000).await.map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&sessions).map_err(|e| e.to_string())
}

/// Export a single session as JSON
#[tauri::command]
pub async fn cmd_export_session(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let mgr = state.session_manager.lock().await;
    let sessions = mgr.list_recent(1000).await.map_err(|e| e.to_string())?;
    let session = sessions.iter().find(|s| s.id == id).ok_or("Session not found")?;
    serde_json::to_string_pretty(session).map_err(|e| e.to_string())
}

/// Import sessions from JSON (merge with existing)
#[tauri::command]
pub async fn cmd_import_sessions(state: State<'_, AppState>, json: String) -> Result<usize, String> {
    let mgr = state.session_manager.lock().await;
    let sessions: Vec<Session> = serde_json::from_str(&json).map_err(|e| format!("Invalid JSON: {e}"))?;
    let count = sessions.len();
    for session in sessions {
        mgr.save(&session).await.map_err(|e| e.to_string())?;
    }
    Ok(count)
}
