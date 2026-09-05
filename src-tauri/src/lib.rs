mod commands;
mod sources;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::apply_text_patch,
            commands::apply_text_patch_to_file,
            commands::check_text_file_changed,
            commands::classify_paths,
            commands::build_folder_merge_plan,
            commands::change_folder_entry_attributes,
            commands::app_runtime_info,
            commands::compare_folder_paths,
            commands::compare_hex_files,
            commands::compare_media_files,
            commands::compare_picture_files,
            commands::compare_registry_exports,
            commands::compare_table,
            commands::compare_table_csv,
            commands::compare_version_files,
            commands::copy_folder_compare_entry,
            commands::create_folder_snapshot,
            commands::delete_folder_entry,
            commands::delete_remote_profile,
            commands::diff_text,
            commands::execute_folder_merge_plan,
            commands::execute_folder_sync,
            commands::export_folder_compare_report,
            commands::export_text_compare_report,
            commands::find_hex_in_file,
            commands::list_archive,
            commands::list_remote_path,
            commands::list_remote_profiles,
            commands::load_admin_policy,
            commands::merge_text_files,
            commands::move_folder_entry,
            commands::parse_text_patch,
            commands::pick_path,
            commands::preview_folder_sync,
            commands::query_live_windows_registry,
            commands::read_text_file,
            commands::register_windows_shell_extension,
            commands::rename_folder_entry,
            commands::run_script,
            commands::save_hex_edits,
            commands::save_remote_profile,
            commands::save_text_file,
            commands::test_remote_profile,
            commands::touch_folder_entry,
            commands::write_git_integration,
            commands::write_svn_integration
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Open Diff application");
}
