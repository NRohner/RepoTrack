pub mod commands;
pub mod db;
pub mod models;
pub mod stats;
pub mod storage;

use commands::AppState;
use db::Database;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            let db = Database::new(&data_dir).expect("Failed to initialize database");
            app.manage(AppState {
                db,
                active_project: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_recent_projects,
            commands::open_project,
            commands::create_project,
            commands::remove_project,
            commands::get_issues,
            commands::create_issue,
            commands::update_issue,
            commands::delete_issue,
            commands::bulk_update_issues,
            commands::add_comment,
            commands::vote_issue,
            commands::get_project_stats,
            commands::get_preferences,
            commands::update_preferences,
            commands::update_project_name,
            commands::get_active_project_path,
            commands::get_active_project,
            commands::close_project,
            commands::list_directory_contents,
            commands::export_csv,
            commands::export_markdown,
            commands::reload_project,
            commands::delete_all_issues,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
