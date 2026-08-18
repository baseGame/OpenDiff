mod commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::apply_text_patch,
            commands::check_text_file_changed,
            commands::build_folder_merge_plan,
            commands::change_folder_entry_attributes,
            commands::compare_folder_paths,
            commands::compare_hex_files,
            commands::compare_media_files,
            commands::compare_picture_files,
            commands::compare_registry_exports,
            commands::compare_table,
            commands::compare_table_csv,
            commands::compare_version_files,
            commands::copy_folder_compare_entry,
            commands::delete_folder_entry,
            commands::diff_text,
            commands::execute_folder_merge_plan,
            commands::execute_folder_sync,
            commands::export_folder_compare_report,
            commands::export_text_compare_report,
            commands::find_hex_in_file,
            commands::merge_text_files,
            commands::move_folder_entry,
            commands::parse_text_patch,
            commands::preview_folder_sync,
            commands::read_text_file,
            commands::rename_folder_entry,
            commands::save_hex_edits,
            commands::save_text_file,
            commands::touch_folder_entry
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Open Diff application");
}
