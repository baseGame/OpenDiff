use std::sync::Arc;
use session::SessionManager;
use tokio::sync::Mutex;
use tauri::Manager;

pub mod commands;

pub struct AppState {
    pub session_manager: Arc<Mutex<SessionManager>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()
                .expect("failed to get app data dir");

            let session_manager = tauri::async_runtime::block_on(async {
                SessionManager::new(&data_dir).await.expect("failed to init session db")
            });

            app.manage(AppState {
                session_manager: Arc::new(Mutex::new(session_manager)),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::diff::cmd_diff_texts,
            commands::diff::cmd_diff_files,
            commands::diff::cmd_merge_three,
            commands::session::cmd_list_recent_sessions,
            commands::session::cmd_save_session,
            commands::session::cmd_delete_session,
            commands::session::cmd_get_settings,
            commands::session::cmd_save_settings,
            commands::vfs::cmd_list_dir,
            commands::vfs::cmd_read_file_text,
            commands::vfs::cmd_read_file_bytes,
            commands::vfs::cmd_stat,
            commands::vfs::cmd_copy_file,
            commands::vfs::cmd_delete_path,
            commands::vfs::cmd_rename_path,
            commands::image_diff::cmd_diff_images,
            commands::table_diff::cmd_diff_tables,
            commands::folder_diff::cmd_diff_folders,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
