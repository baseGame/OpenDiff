use session::{Session, SessionKind, AppSettings, SessionManager};
use tauri::State;
use crate::AppState;

#[tauri::command]
pub async fn cmd_list_recent_sessions(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<Session>, String> {
    let mgr = state.session_manager.lock().await;
    mgr.list_recent(limit.unwrap_or(20))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_save_session(
    state: State<'_, AppState>,
    session: Session,
) -> Result<(), String> {
    let mgr = state.session_manager.lock().await;
    mgr.save_session(&session).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_session(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let mgr = state.session_manager.lock().await;
    mgr.delete_session(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_settings(
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    let mgr = state.session_manager.lock().await;
    mgr.get_settings().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_save_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    let mgr = state.session_manager.lock().await;
    mgr.save_settings(&settings).await.map_err(|e| e.to_string())
}
