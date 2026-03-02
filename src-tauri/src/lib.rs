pub mod auth;
pub mod commands;
pub mod db;
pub mod git;
pub mod models;
pub mod stats;
pub mod storage;

use commands::{AppState, RecentProjectPaths};
use db::Database;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

pub fn build_app_menu(
    handle: &tauri::AppHandle,
    recent_projects: &[(String, String)],
) -> tauri::Result<Menu<tauri::Wry>> {
    // App submenu
    let app_submenu = Submenu::with_items(
        handle,
        "RepoTrack",
        true,
        &[
            &PredefinedMenuItem::about(handle, None, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::services(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::show_all(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;

    // File submenu
    let open_project = MenuItem::with_id(
        handle,
        "open-project",
        "Open Project...",
        true,
        Some("CmdOrCtrl+O"),
    )?;

    // Recent projects submenu
    let mut recent_menu_items = Vec::new();
    for (i, (name, _path)) in recent_projects.iter().take(10).enumerate() {
        recent_menu_items.push(MenuItem::with_id(
            handle,
            format!("recent-project-{}", i),
            name,
            true,
            None::<&str>,
        )?);
    }
    let recent_submenu = Submenu::new(handle, "Open Recent", !recent_menu_items.is_empty())?;
    for item in &recent_menu_items {
        recent_submenu.append(item)?;
    }

    let export_csv = MenuItem::with_id(
        handle,
        "export-csv",
        "Export as CSV...",
        true,
        Some("CmdOrCtrl+Shift+E"),
    )?;
    let export_markdown = MenuItem::with_id(
        handle,
        "export-markdown",
        "Export as Markdown...",
        true,
        Some("CmdOrCtrl+Shift+M"),
    )?;

    let file_submenu = Submenu::with_items(
        handle,
        "File",
        true,
        &[
            &open_project,
            &recent_submenu,
            &PredefinedMenuItem::separator(handle)?,
            &export_csv,
            &export_markdown,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;

    // Edit submenu
    let edit_submenu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;

    // Window submenu
    let window_submenu = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;

    Menu::with_items(
        handle,
        &[&app_submenu, &file_submenu, &edit_submenu, &window_submenu],
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Enable continuous spell-check underlines in macOS WKWebView.
    // By default, WebContinuousSpellCheckingEnabled is false, so the spell
    // checker detects errors (right-click suggestions work) but red underlines
    // are not drawn. We must set this in-process via NSUserDefaults BEFORE the
    // webview is created — using `defaults write` (out-of-process) doesn't work
    // because the in-memory NSUserDefaults cache won't pick it up in time.
    // See: https://github.com/tauri-apps/tauri/issues/7705
    #[cfg(target_os = "macos")]
    {
        use objc2_foundation::{NSString, NSUserDefaults};

        unsafe {
            let defaults = NSUserDefaults::standardUserDefaults();
            let key = NSString::from_str("WebContinuousSpellCheckingEnabled");
            defaults.setBool_forKey(true, &key);
        }
    }

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

            // Query recent projects for menu
            let projects = db.list_projects().unwrap_or_default();
            let recent: Vec<(String, String)> = projects
                .iter()
                .filter(|p| p.exists)
                .take(10)
                .map(|p| (p.name.clone(), p.path.clone()))
                .collect();

            // Restore user session from DB
            let restored_user = db.get_any_auth_user().ok().flatten();

            app.manage(AppState {
                db,
                active_project: Mutex::new(None),
                current_user: Mutex::new(restored_user),
            });
            app.manage(RecentProjectPaths(Mutex::new(recent.clone())));

            // Build and set menu
            let handle = app.handle();
            let menu = build_app_menu(handle, &recent)?;
            handle.set_menu(menu)?;

            // Handle menu events
            handle.on_menu_event(|app_handle, event| {
                let id = event.id().0.as_str();
                let payload = if id.starts_with("recent-project-") {
                    if let Ok(index) =
                        id.strip_prefix("recent-project-").unwrap().parse::<usize>()
                    {
                        let paths = app_handle.state::<RecentProjectPaths>();
                        let paths = paths.0.lock().unwrap();
                        if let Some((_name, path)) = paths.get(index) {
                            format!("open-recent:{}", path)
                        } else {
                            return;
                        }
                    } else {
                        return;
                    }
                } else {
                    match id {
                        "open-project" | "export-csv" | "export-markdown" => id.to_string(),
                        _ => return,
                    }
                };
                let _ = app_handle.emit("menu-event", payload);
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
            commands::migrate_project,
            commands::add_attachment,
            commands::remove_attachment,
            commands::open_attachment,
            commands::get_attachment_data,
            commands::update_recent_menu,
            commands::list_color_themes,
            commands::get_color_theme,
            commands::create_color_theme,
            commands::update_color_theme,
            commands::delete_color_theme,
            auth::sign_in,
            auth::sign_out,
            auth::get_current_user,
            git::git_get_status,
            git::git_get_branches,
            git::git_get_log,
            git::git_checkout_branch,
            git::git_commit_repotrack,
            git::git_push,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
