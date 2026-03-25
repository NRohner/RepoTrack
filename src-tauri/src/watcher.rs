use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::AppState;
use crate::storage;

/// Handle to a running file watcher. Dropping it stops the watcher.
pub struct WatcherHandle {
    /// Sending on this channel signals the watcher thread to stop.
    _stop_tx: mpsc::Sender<()>,
}

/// Shared, swappable watcher stored in Tauri managed state.
pub struct FileWatcher(pub Mutex<Option<WatcherHandle>>);

/// Start watching the `.repotrack/` directory inside `project_path`.
/// Returns a `WatcherHandle` that stops the watcher when dropped.
pub fn start_watching(
    project_path: &str,
    app_handle: AppHandle,
) -> Result<WatcherHandle, String> {
    let repotrack_dir = Path::new(project_path).join(".repotrack");
    if !repotrack_dir.exists() {
        return Err(format!(
            ".repotrack directory not found at {}",
            repotrack_dir.display()
        ));
    }

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (event_tx, event_rx) = mpsc::channel::<Event>();

    // Create the notify watcher — it sends events to event_tx.
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = event_tx.send(event);
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create file watcher: {}", e))?;

    watcher
        .watch(&repotrack_dir, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    let project_path = project_path.to_string();

    // Debounce thread: collects events for 1 second, then fires a single reload.
    thread::spawn(move || {
        // Keep the watcher alive for the lifetime of this thread.
        let _watcher = watcher;

        let debounce = Duration::from_secs(1);
        let mut last_event: Option<Instant> = None;
        // Track whether we have a pending reload that hasn't been emitted yet.
        let mut pending = false;

        loop {
            // Check for stop signal (non-blocking).
            if stop_rx.try_recv().is_ok() {
                break;
            }

            // Drain all pending file-system events.
            while let Ok(_event) = event_rx.try_recv() {
                last_event = Some(Instant::now());
                pending = true;
            }

            // If we have a pending event and the debounce period has passed, fire.
            if pending {
                if let Some(t) = last_event {
                    if t.elapsed() >= debounce {
                        pending = false;
                        // Reload the in-memory project state from disk.
                        reload_and_emit(&project_path, &app_handle);
                    }
                }
            }

            // Sleep briefly to avoid busy-spinning.
            thread::sleep(Duration::from_millis(100));
        }
    });

    Ok(WatcherHandle { _stop_tx: stop_tx })
}

/// Re-read the project from disk into AppState and emit an event to the frontend.
fn reload_and_emit(project_path: &str, app_handle: &AppHandle) {
    // Reload from disk using the storage layer.
    let meta = match storage::read_project_metadata(project_path) {
        Ok(m) => m,
        Err(_) => return, // Silently skip if we can't read (file might be mid-write).
    };
    let issues = match storage::read_all_issues(project_path) {
        Ok(i) => i,
        Err(_) => return,
    };

    // Update the in-memory ActiveProject so get_issues stays consistent.
    if let Some(state) = app_handle.try_state::<AppState>() {
        let mut active = match state.active_project.lock() {
            Ok(a) => a,
            Err(_) => return,
        };
        if let Some(ref mut project) = *active {
            // Only update if this is still the same project.
            if project.path == project_path {
                project.issues = issues;
                project.project_name = meta.project_name;
                project.updated_at = meta.updated_at;
                project.id_counters = meta.id_counters;
            }
        }
    }

    // Emit event to the frontend.
    let _ = app_handle.emit("repotrack-files-changed", ());
}
