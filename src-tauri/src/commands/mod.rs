use crate::db::Database;
use crate::models::*;
use crate::stats::compute_stats;
use crate::storage;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub db: Database,
    pub active_project: Mutex<Option<ActiveProject>>,
    pub current_user: Mutex<Option<UserInfo>>,
}

pub struct ActiveProject {
    pub path: String,
    pub format: StorageFormat,
    pub project_name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub issues: Vec<Issue>,
    pub id_counters: HashMap<String, u32>,
}

impl ActiveProject {
    pub fn to_repotrack_file(&self) -> RepoTrackFile {
        RepoTrackFile {
            _repotrack: REPOTRACK_NOTICE.to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            project_name: self.project_name.clone(),
            created_at: self.created_at,
            updated_at: self.updated_at,
            issues: self.issues.clone(),
            storage_format: Some(self.format.clone()),
        }
    }

    pub fn to_metadata(&self) -> ProjectMetadata {
        ProjectMetadata {
            _repotrack: REPOTRACK_NOTICE.to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            project_name: self.project_name.clone(),
            created_at: self.created_at,
            updated_at: self.updated_at,
            id_counters: self.id_counters.clone(),
        }
    }

    pub fn next_id(&mut self, issue_type: &IssueType) -> String {
        match self.format {
            StorageFormat::Directory => {
                let mut meta = self.to_metadata();
                let id = meta.next_id(issue_type);
                self.id_counters = meta.id_counters;
                id
            }
            StorageFormat::Legacy => {
                // Use the legacy RepoTrackFile method logic
                let prefix = match issue_type {
                    IssueType::Bug => "BUG",
                    IssueType::Feature => "FEAT",
                    IssueType::Improvement => "IMP",
                    IssueType::Task => "TASK",
                };
                let max_num = self
                    .issues
                    .iter()
                    .filter(|i| &i.issue_type == issue_type)
                    .filter_map(|i| {
                        i.id.split('-')
                            .last()
                            .and_then(|n| n.parse::<u32>().ok())
                    })
                    .max()
                    .unwrap_or(0);
                format!("{}-{:04}", prefix, max_num + 1)
            }
        }
    }
}

pub struct RecentProjectPaths(pub Mutex<Vec<(String, String)>>);

type CmdResult<T> = Result<T, String>;

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn get_current_user_info(state: &AppState) -> UserInfo {
    state
        .current_user
        .lock()
        .ok()
        .and_then(|guard| guard.clone())
        .unwrap_or_default()
}

// --- Format-aware save helpers ---

fn save_single_issue(project: &ActiveProject, issue: &Issue) -> Result<(), String> {
    match project.format {
        StorageFormat::Legacy => {
            let rt_path = storage::repotrack_path(&project.path);
            let data = project.to_repotrack_file();
            storage::write_repotrack_file(&rt_path, &data).map_err(map_err)
        }
        StorageFormat::Directory => {
            storage::write_issue(&project.path, issue).map_err(map_err)?;
            let mut meta = project.to_metadata();
            meta.updated_at = project.updated_at;
            storage::write_project_metadata(&project.path, &meta).map_err(map_err)
        }
    }
}

fn save_project_after_delete(project: &ActiveProject, deleted: &Issue) -> Result<(), String> {
    match project.format {
        StorageFormat::Legacy => {
            let rt_path = storage::repotrack_path(&project.path);
            let data = project.to_repotrack_file();
            storage::write_repotrack_file(&rt_path, &data).map_err(map_err)
        }
        StorageFormat::Directory => {
            storage::delete_issue_dir(&project.path, &deleted.issue_type, &deleted.uuid)
                .map_err(map_err)?;
            let mut meta = project.to_metadata();
            meta.updated_at = project.updated_at;
            storage::write_project_metadata(&project.path, &meta).map_err(map_err)
        }
    }
}

fn save_full_project(project: &ActiveProject) -> Result<(), String> {
    match project.format {
        StorageFormat::Legacy => {
            let rt_path = storage::repotrack_path(&project.path);
            let data = project.to_repotrack_file();
            storage::write_repotrack_file(&rt_path, &data).map_err(map_err)
        }
        StorageFormat::Directory => {
            for issue in &project.issues {
                storage::write_issue(&project.path, issue).map_err(map_err)?;
            }
            let meta = project.to_metadata();
            storage::write_project_metadata(&project.path, &meta).map_err(map_err)
        }
    }
}

fn save_metadata_only(project: &ActiveProject) -> Result<(), String> {
    match project.format {
        StorageFormat::Legacy => {
            let rt_path = storage::repotrack_path(&project.path);
            let data = project.to_repotrack_file();
            storage::write_repotrack_file(&rt_path, &data).map_err(map_err)
        }
        StorageFormat::Directory => {
            let meta = project.to_metadata();
            storage::write_project_metadata(&project.path, &meta).map_err(map_err)
        }
    }
}

// --- Duplicate display ID detection & repair ---

fn fix_duplicate_ids(project: &mut ActiveProject) -> bool {
    let mut seen: HashMap<String, usize> = HashMap::new();
    let mut duplicates: Vec<usize> = Vec::new();

    for (idx, issue) in project.issues.iter().enumerate() {
        if seen.contains_key(&issue.id) {
            duplicates.push(idx);
        } else {
            seen.insert(issue.id.clone(), idx);
        }
    }

    if duplicates.is_empty() {
        return false;
    }

    // Build max counters from all existing IDs
    for issue in &project.issues {
        let key = match issue.issue_type {
            IssueType::Bug => "bug",
            IssueType::Feature => "feature",
            IssueType::Improvement => "improvement",
            IssueType::Task => "task",
        };
        if let Some(num) = issue.id.split('-').last().and_then(|n| n.parse::<u32>().ok()) {
            let counter = project.id_counters.entry(key.to_string()).or_insert(0);
            if num > *counter {
                *counter = num;
            }
        }
    }

    // Reassign duplicates
    for idx in duplicates {
        let issue_type = project.issues[idx].issue_type.clone();
        let new_id = project.next_id(&issue_type);
        project.issues[idx].id = new_id;
    }

    true
}

// --- Helper: load project from either format ---

fn load_project(path: &str) -> Result<ActiveProject, String> {
    match storage::detect_format(path) {
        Some(StorageFormat::Directory) => {
            let meta = storage::read_project_metadata(path).map_err(map_err)?;
            let issues = storage::read_all_issues(path).map_err(map_err)?;
            let mut project = ActiveProject {
                path: path.to_string(),
                format: StorageFormat::Directory,
                project_name: meta.project_name,
                created_at: meta.created_at,
                updated_at: meta.updated_at,
                issues,
                id_counters: meta.id_counters,
            };
            if fix_duplicate_ids(&mut project) {
                // Write back fixed issues
                for issue in &project.issues {
                    storage::write_issue(path, issue).map_err(map_err)?;
                }
                let meta = project.to_metadata();
                storage::write_project_metadata(path, &meta).map_err(map_err)?;
            }
            Ok(project)
        }
        Some(StorageFormat::Legacy) => {
            let rt_path = storage::repotrack_path(path);
            let data = storage::read_repotrack_file(&rt_path).map_err(map_err)?;
            Ok(ActiveProject {
                path: path.to_string(),
                format: StorageFormat::Legacy,
                project_name: data.project_name,
                created_at: data.created_at,
                updated_at: data.updated_at,
                issues: data.issues,
                id_counters: HashMap::new(),
            })
        }
        None => Err(format!("No RepoTrack project found at {}", path)),
    }
}

// --- Commands ---

#[tauri::command]
pub fn list_recent_projects(state: State<AppState>) -> CmdResult<Vec<ProjectInfo>> {
    let mut projects = state.db.list_projects().map_err(map_err)?;
    for project in &mut projects {
        match storage::detect_format(&project.path) {
            Some(StorageFormat::Directory) => {
                if let Ok(meta) = storage::read_project_metadata(&project.path) {
                    project.name = meta.project_name;
                    if let Ok(issues) = storage::read_all_issues(&project.path) {
                        project.open_issues = issues
                            .iter()
                            .filter(|i| i.status == "open" || i.status == "in-progress")
                            .count() as i32;
                    }
                }
            }
            Some(StorageFormat::Legacy) => {
                let rt_path = storage::repotrack_path(&project.path);
                if let Ok(data) = storage::read_repotrack_file(&rt_path) {
                    project.open_issues = data
                        .issues
                        .iter()
                        .filter(|i| i.status == "open" || i.status == "in-progress")
                        .count() as i32;
                    project.name = data.project_name.clone();
                }
            }
            None => {}
        }
    }
    Ok(projects)
}

#[tauri::command]
pub fn open_project(path: String, state: State<AppState>) -> CmdResult<RepoTrackFile> {
    let project = load_project(&path)?;

    // Ensure the project exists in the database (upsert), then update last_opened
    state
        .db
        .add_project(&project.project_name, &path)
        .map_err(map_err)?;

    let result = project.to_repotrack_file();
    let mut active = state.active_project.lock().map_err(map_err)?;
    *active = Some(project);
    Ok(result)
}

#[tauri::command]
pub fn create_project(
    path: String,
    name: String,
    state: State<AppState>,
) -> CmdResult<RepoTrackFile> {
    // New projects always use directory format
    storage::create_directory_structure(&path).map_err(map_err)?;
    let meta = ProjectMetadata::new(name.clone());
    storage::write_project_metadata(&path, &meta).map_err(map_err)?;

    state.db.add_project(&name, &path).map_err(map_err)?;

    let project = ActiveProject {
        path: path.clone(),
        format: StorageFormat::Directory,
        project_name: name,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        issues: Vec::new(),
        id_counters: HashMap::new(),
    };

    let result = project.to_repotrack_file();
    let mut active = state.active_project.lock().map_err(map_err)?;
    *active = Some(project);
    Ok(result)
}

#[tauri::command]
pub fn remove_project(path: String, state: State<AppState>) -> CmdResult<()> {
    state.db.remove_project(&path).map_err(map_err)?;
    let mut active = state.active_project.lock().map_err(map_err)?;
    if active.as_ref().map(|a| a.path == path).unwrap_or(false) {
        *active = None;
    }
    Ok(())
}

#[tauri::command]
pub fn get_issues(state: State<AppState>) -> CmdResult<Vec<Issue>> {
    let active = state.active_project.lock().map_err(map_err)?;
    match active.as_ref() {
        Some(project) => Ok(project.issues.clone()),
        None => Err("No project is open".to_string()),
    }
}

#[tauri::command]
pub fn create_issue(request: CreateIssueRequest, state: State<AppState>) -> CmdResult<Issue> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let now = Utc::now();
    let id = project.next_id(&request.issue_type);
    let uuid = generate_uuid();
    let default_status = "open".to_string();

    let user = get_current_user_info(&state);
    let created_by = if user.provider != "anon" {
        Some(user.clone())
    } else {
        None
    };

    let history_entry = HistoryEntry {
        action: "created".to_string(),
        from: None,
        to: None,
        user: user.clone(),
        timestamp: now,
    };

    let issue = Issue {
        id: id.clone(),
        uuid,
        title: request.title,
        description: request.description,
        issue_type: request.issue_type.clone(),
        severity: if matches!(
            request.issue_type,
            IssueType::Bug | IssueType::Improvement | IssueType::Task
        ) {
            request.severity.or(Some(Severity::Medium))
        } else {
            None
        },
        priority: if request.issue_type == IssueType::Feature {
            request.priority.or(Some(Severity::Medium))
        } else {
            None
        },
        status: default_status,
        tags: request.tags,
        created_at: now,
        updated_at: now,
        resolved_at: None,
        steps_to_reproduce: request.steps_to_reproduce,
        expected_behavior: request.expected_behavior,
        actual_behavior: request.actual_behavior,
        environment: request.environment,
        use_case: request.use_case,
        acceptance_criteria: request.acceptance_criteria,
        votes: if request.issue_type == IssueType::Feature {
            Some(0)
        } else {
            None
        },
        roadmap_quarter: request.roadmap_quarter,
        comments: Vec::new(),
        attachments: Vec::new(),
        linked_files: request.linked_files,
        time_estimate_hours: request.time_estimate_hours,
        time_spent_hours: None,
        created_by,
        history: vec![history_entry],
    };

    project.issues.push(issue.clone());
    project.updated_at = now;

    save_single_issue(project, &issue)?;

    let type_str = format!("{:?}", request.issue_type).to_lowercase();
    let _ = state.db.log_activity(
        &project.path,
        &id,
        &issue.title,
        &type_str,
        "created",
        &user.display_name,
    );

    Ok(issue)
}

#[tauri::command]
pub fn update_issue(request: UpdateIssueRequest, state: State<AppState>) -> CmdResult<Issue> {
    let user = get_current_user_info(&state);
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let issue = project
        .issues
        .iter_mut()
        .find(|i| i.id == request.id)
        .ok_or(format!("Issue {} not found", request.id))?;

    let now = Utc::now();
    let old_status = issue.status.clone();

    if let Some(title) = request.title {
        issue.title = title;
    }
    if let Some(desc) = request.description {
        issue.description = desc;
    }
    if let Some(sev) = request.severity {
        issue.severity = Some(sev);
    }
    if let Some(pri) = request.priority {
        issue.priority = Some(pri);
    }
    if let Some(status) = request.status.clone() {
        issue.status = status.clone();
        if status == "completed" && issue.resolved_at.is_none() {
            issue.resolved_at = Some(now);
        }
        if status == "open" || status == "in-progress" {
            issue.resolved_at = None;
        }
    }
    if let Some(tags) = request.tags {
        issue.tags = tags;
    }
    if let Some(str) = request.steps_to_reproduce {
        issue.steps_to_reproduce = Some(str);
    }
    if let Some(eb) = request.expected_behavior {
        issue.expected_behavior = Some(eb);
    }
    if let Some(ab) = request.actual_behavior {
        issue.actual_behavior = Some(ab);
    }
    if let Some(env) = request.environment {
        issue.environment = Some(env);
    }
    if let Some(uc) = request.use_case {
        issue.use_case = Some(uc);
    }
    if let Some(ac) = request.acceptance_criteria {
        issue.acceptance_criteria = Some(ac);
    }
    if let Some(rq) = request.roadmap_quarter {
        issue.roadmap_quarter = Some(rq);
    }
    if let Some(lf) = request.linked_files {
        issue.linked_files = lf;
    }
    if let Some(te) = request.time_estimate_hours {
        issue.time_estimate_hours = Some(te);
    }
    if let Some(ts) = request.time_spent_hours {
        issue.time_spent_hours = Some(ts);
    }
    if let Some(v) = request.votes {
        issue.votes = Some(v);
    }
    if let Some(ra) = request.resolved_at {
        issue.resolved_at = ra;
    }

    // Push history entry for status change before cloning
    let status_changed = if let Some(ref new_status) = request.status {
        if *new_status != old_status {
            issue.history.push(HistoryEntry {
                action: "status_changed".to_string(),
                from: Some(old_status.clone()),
                to: Some(new_status.clone()),
                user: user.clone(),
                timestamp: now,
            });
            Some((old_status.clone(), new_status.clone()))
        } else {
            None
        }
    } else {
        None
    };

    issue.updated_at = now;
    project.updated_at = now;

    let result = issue.clone();
    save_single_issue(project, &result)?;

    if let Some((from, to)) = status_changed {
        let action = format!("status changed from {} to {}", from, to);
        let type_str = format!("{:?}", result.issue_type).to_lowercase();
        let _ = state.db.log_activity(
            &project.path,
            &result.id,
            &result.title,
            &type_str,
            &action,
            &user.display_name,
        );
    }

    Ok(result)
}

#[tauri::command]
pub fn delete_issue(id: String, state: State<AppState>) -> CmdResult<()> {
    let user = get_current_user_info(&state);
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let idx = project
        .issues
        .iter()
        .position(|i| i.id == id)
        .ok_or(format!("Issue {} not found", id))?;
    let removed = project.issues.remove(idx);
    project.updated_at = Utc::now();

    save_project_after_delete(project, &removed)?;

    let type_str = format!("{:?}", removed.issue_type).to_lowercase();
    let _ = state.db.log_activity(
        &project.path,
        &id,
        &removed.title,
        &type_str,
        "deleted",
        &user.display_name,
    );

    Ok(())
}

#[tauri::command]
pub fn bulk_update_issues(
    request: BulkUpdateRequest,
    state: State<AppState>,
) -> CmdResult<Vec<Issue>> {
    let user = get_current_user_info(&state);
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let now = Utc::now();
    let mut updated = Vec::new();

    for issue in project.issues.iter_mut() {
        if request.ids.contains(&issue.id) {
            let old_status = issue.status.clone();
            if let Some(ref status) = request.status {
                issue.status = status.clone();
                if status == "completed" {
                    if issue.resolved_at.is_none() {
                        issue.resolved_at = Some(now);
                    }
                }
                if *status != old_status {
                    issue.history.push(HistoryEntry {
                        action: "status_changed".to_string(),
                        from: Some(old_status),
                        to: Some(status.clone()),
                        user: user.clone(),
                        timestamp: now,
                    });
                }
            }
            if let Some(ref sev) = request.severity {
                issue.severity = Some(sev.clone());
            }
            if let Some(ref pri) = request.priority {
                issue.priority = Some(pri.clone());
            }
            if let Some(ref add) = request.tags_add {
                for tag in add {
                    if !issue.tags.contains(tag) {
                        issue.tags.push(tag.clone());
                    }
                }
            }
            if let Some(ref remove) = request.tags_remove {
                issue.tags.retain(|t| !remove.contains(t));
            }
            issue.updated_at = now;
            updated.push(issue.clone());
        }
    }
    project.updated_at = now;

    // For directory format, write each changed issue individually
    match project.format {
        StorageFormat::Legacy => {
            let rt_path = storage::repotrack_path(&project.path);
            let data = project.to_repotrack_file();
            storage::write_repotrack_file(&rt_path, &data).map_err(map_err)?;
        }
        StorageFormat::Directory => {
            for issue in &updated {
                storage::write_issue(&project.path, issue).map_err(map_err)?;
            }
            let meta = project.to_metadata();
            storage::write_project_metadata(&project.path, &meta).map_err(map_err)?;
        }
    }

    Ok(updated)
}

#[tauri::command]
pub fn add_comment(issue_id: String, text: String, state: State<AppState>) -> CmdResult<Comment> {
    let user = get_current_user_info(&state);
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let idx = project
        .issues
        .iter()
        .position(|i| i.id == issue_id)
        .ok_or(format!("Issue {} not found", issue_id))?;

    let now = Utc::now();
    let comment_num = project.issues[idx].comments.len() + 1;
    let created_by = if user.provider != "anon" {
        Some(user.clone())
    } else {
        None
    };
    let comment = Comment {
        id: format!("CMT-{:04}", comment_num),
        text,
        created_at: now,
        created_by,
    };

    project.issues[idx].comments.push(comment.clone());
    project.issues[idx].history.push(HistoryEntry {
        action: "comment_added".to_string(),
        from: None,
        to: None,
        user: user.clone(),
        timestamp: now,
    });
    project.issues[idx].updated_at = now;
    project.updated_at = now;

    let issue_clone = project.issues[idx].clone();
    save_single_issue(project, &issue_clone)?;

    let type_str = format!("{:?}", project.issues[idx].issue_type).to_lowercase();
    let title = project.issues[idx].title.clone();
    let _ = state.db.log_activity(
        &project.path,
        &issue_id,
        &title,
        &type_str,
        "comment added",
        &user.display_name,
    );

    Ok(comment)
}

#[tauri::command]
pub fn vote_issue(issue_id: String, state: State<AppState>) -> CmdResult<i32> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let idx = project
        .issues
        .iter()
        .position(|i| i.id == issue_id)
        .ok_or(format!("Issue {} not found", issue_id))?;

    let new_votes = project.issues[idx].votes.unwrap_or(0) + 1;
    project.issues[idx].votes = Some(new_votes);
    project.issues[idx].updated_at = Utc::now();
    project.updated_at = Utc::now();

    let issue_clone = project.issues[idx].clone();
    save_single_issue(project, &issue_clone)?;

    Ok(new_votes)
}

#[tauri::command]
pub fn get_project_stats(state: State<AppState>) -> CmdResult<ProjectStats> {
    let active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_ref().ok_or("No project is open")?;

    let activity = state
        .db
        .get_activity(&project.path, 50)
        .map_err(map_err)?;
    let data = project.to_repotrack_file();
    Ok(compute_stats(&data, activity))
}

#[tauri::command]
pub fn get_preferences(state: State<AppState>) -> CmdResult<UserPreferences> {
    state.db.get_preferences().map_err(map_err)
}

#[tauri::command]
pub fn update_preferences(prefs: UserPreferences, state: State<AppState>) -> CmdResult<()> {
    state.db.update_preferences(&prefs).map_err(map_err)
}

#[tauri::command]
pub fn update_project_name(name: String, state: State<AppState>) -> CmdResult<()> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    project.project_name = name;
    project.updated_at = Utc::now();

    save_metadata_only(project)
}

#[tauri::command]
pub fn get_active_project_path(state: State<AppState>) -> CmdResult<String> {
    let active = state.active_project.lock().map_err(map_err)?;
    match active.as_ref() {
        Some(project) => Ok(project.path.clone()),
        None => Err("No project is open".to_string()),
    }
}

#[tauri::command]
pub fn get_active_project(state: State<AppState>) -> CmdResult<Option<RepoTrackFile>> {
    let active = state.active_project.lock().map_err(map_err)?;
    Ok(active.as_ref().map(|p| p.to_repotrack_file()))
}

#[tauri::command]
pub fn close_project(state: State<AppState>) -> CmdResult<()> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    *active = None;
    Ok(())
}

#[tauri::command]
pub fn list_directory_contents(dir: String) -> CmdResult<Vec<storage::DirEntry>> {
    storage::list_directory(&dir).map_err(map_err)
}

#[tauri::command]
pub fn export_csv(path: String, state: State<AppState>) -> CmdResult<()> {
    let active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_ref().ok_or("No project is open")?;

    let mut wtr = csv::Writer::from_path(&path).map_err(map_err)?;
    wtr.write_record(&[
        "ID",
        "Title",
        "Type",
        "Status",
        "Severity",
        "Priority",
        "Tags",
        "Created",
        "Updated",
        "Resolved",
        "Votes",
        "Time Estimate",
        "Time Spent",
        "Description",
    ])
    .map_err(map_err)?;

    for issue in &project.issues {
        wtr.write_record(&[
            &issue.id,
            &issue.title,
            &format!("{:?}", issue.issue_type).to_lowercase(),
            &issue.status,
            &issue
                .severity
                .as_ref()
                .map(|s| format!("{:?}", s).to_lowercase())
                .unwrap_or_default(),
            &issue
                .priority
                .as_ref()
                .map(|p| format!("{:?}", p).to_lowercase())
                .unwrap_or_default(),
            &issue.tags.join(", "),
            &issue.created_at.to_rfc3339(),
            &issue.updated_at.to_rfc3339(),
            &issue
                .resolved_at
                .map(|r| r.to_rfc3339())
                .unwrap_or_default(),
            &issue.votes.map(|v| v.to_string()).unwrap_or_default(),
            &issue
                .time_estimate_hours
                .map(|t| t.to_string())
                .unwrap_or_default(),
            &issue
                .time_spent_hours
                .map(|t| t.to_string())
                .unwrap_or_default(),
            &issue.description,
        ])
        .map_err(map_err)?;
    }
    wtr.flush().map_err(map_err)?;
    Ok(())
}

#[tauri::command]
pub fn export_markdown(path: String, state: State<AppState>) -> CmdResult<()> {
    let active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_ref().ok_or("No project is open")?;

    let mut content = format!("# {} — Issue Tracker\n\n", project.project_name);
    content.push_str(&format!(
        "Generated: {}\n\n",
        Utc::now().format("%Y-%m-%d %H:%M UTC")
    ));

    let bugs: Vec<&Issue> = project
        .issues
        .iter()
        .filter(|i| i.issue_type == IssueType::Bug)
        .collect();
    let features: Vec<&Issue> = project
        .issues
        .iter()
        .filter(|i| i.issue_type == IssueType::Feature)
        .collect();
    let others: Vec<&Issue> = project
        .issues
        .iter()
        .filter(|i| i.issue_type != IssueType::Bug && i.issue_type != IssueType::Feature)
        .collect();

    if !bugs.is_empty() {
        content.push_str("## Bugs\n\n");
        for bug in &bugs {
            content.push_str(&format!("### {} — {}\n\n", bug.id, bug.title));
            content.push_str(&format!(
                "**Status:** {} | **Severity:** {}\n\n",
                bug.status,
                bug.severity
                    .as_ref()
                    .map(|s| format!("{:?}", s).to_lowercase())
                    .unwrap_or_default()
            ));
            if !bug.description.is_empty() {
                content.push_str(&format!("{}\n\n", bug.description));
            }
        }
    }

    if !features.is_empty() {
        content.push_str("## Feature Requests\n\n");
        for feat in &features {
            content.push_str(&format!("### {} — {}\n\n", feat.id, feat.title));
            content.push_str(&format!(
                "**Status:** {} | **Priority:** {} | **Votes:** {}\n\n",
                feat.status,
                feat.priority
                    .as_ref()
                    .map(|p| format!("{:?}", p).to_lowercase())
                    .unwrap_or_default(),
                feat.votes.unwrap_or(0)
            ));
            if !feat.description.is_empty() {
                content.push_str(&format!("{}\n\n", feat.description));
            }
        }
    }

    if !others.is_empty() {
        content.push_str("## Other Issues\n\n");
        for issue in &others {
            content.push_str(&format!("### {} — {}\n\n", issue.id, issue.title));
            content.push_str(&format!(
                "**Type:** {:?} | **Status:** {}\n\n",
                issue.issue_type, issue.status
            ));
            if !issue.description.is_empty() {
                content.push_str(&format!("{}\n\n", issue.description));
            }
        }
    }

    std::fs::write(&path, content).map_err(map_err)?;
    Ok(())
}

#[tauri::command]
pub fn reload_project(state: State<AppState>) -> CmdResult<RepoTrackFile> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let current_path = active
        .as_ref()
        .ok_or("No project is open")?
        .path
        .clone();

    let project = load_project(&current_path)?;
    let result = project.to_repotrack_file();
    *active = Some(project);
    Ok(result)
}

#[tauri::command]
pub fn delete_all_issues(issue_type: Option<String>, state: State<AppState>) -> CmdResult<()> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    // Collect issues to delete for directory format cleanup
    let to_delete: Vec<Issue> = match issue_type.as_deref() {
        Some("bug") => project
            .issues
            .iter()
            .filter(|i| i.issue_type == IssueType::Bug)
            .cloned()
            .collect(),
        Some("feature") => project
            .issues
            .iter()
            .filter(|i| i.issue_type == IssueType::Feature)
            .cloned()
            .collect(),
        _ => project.issues.clone(),
    };

    match issue_type.as_deref() {
        Some("bug") => project.issues.retain(|i| i.issue_type != IssueType::Bug),
        Some("feature") => project.issues.retain(|i| i.issue_type != IssueType::Feature),
        _ => project.issues.clear(),
    }
    project.updated_at = Utc::now();

    match project.format {
        StorageFormat::Legacy => {
            let rt_path = storage::repotrack_path(&project.path);
            let data = project.to_repotrack_file();
            storage::write_repotrack_file(&rt_path, &data).map_err(map_err)?;
        }
        StorageFormat::Directory => {
            for issue in &to_delete {
                storage::delete_issue_dir(&project.path, &issue.issue_type, &issue.uuid)
                    .map_err(map_err)?;
            }
            let meta = project.to_metadata();
            storage::write_project_metadata(&project.path, &meta).map_err(map_err)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn migrate_project(state: State<AppState>) -> CmdResult<RepoTrackFile> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    if project.format != StorageFormat::Legacy {
        return Err("Project is already using directory format".to_string());
    }

    // 1. Create directory structure
    storage::create_directory_structure(&project.path).map_err(map_err)?;

    // 2. Compute id_counters from existing issue IDs
    let mut id_counters: HashMap<String, u32> = HashMap::new();
    for issue in &project.issues {
        let key = match issue.issue_type {
            IssueType::Bug => "bug",
            IssueType::Feature => "feature",
            IssueType::Improvement => "improvement",
            IssueType::Task => "task",
        };
        if let Some(num) = issue.id.split('-').last().and_then(|n| n.parse::<u32>().ok()) {
            let counter = id_counters.entry(key.to_string()).or_insert(0);
            if num > *counter {
                *counter = num;
            }
        }
    }
    project.id_counters = id_counters;

    // 3. Assign UUIDs to issues that don't have meaningful ones
    //    (serde default will have given them random UUIDs on deserialize,
    //    but let's ensure they're set)
    for issue in &mut project.issues {
        if issue.uuid.is_empty() {
            issue.uuid = generate_uuid();
        }
    }

    // 4. Write each issue to its own directory
    for issue in &project.issues {
        storage::write_issue(&project.path, issue).map_err(map_err)?;
    }

    // 5. Write project.json
    let meta = ProjectMetadata {
        _repotrack: REPOTRACK_NOTICE.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        project_name: project.project_name.clone(),
        created_at: project.created_at,
        updated_at: project.updated_at,
        id_counters: project.id_counters.clone(),
    };
    storage::write_project_metadata(&project.path, &meta).map_err(map_err)?;

    // 6. Delete old repotrack.json
    let legacy_path = storage::repotrack_path(&project.path);
    if legacy_path.exists() {
        std::fs::remove_file(&legacy_path).map_err(map_err)?;
    }

    // 7. Update in-memory format
    project.format = StorageFormat::Directory;

    Ok(project.to_repotrack_file())
}

// --- Attachment commands ---

fn deduplicate_filename(existing: &[Attachment], original: &str) -> String {
    let path = std::path::Path::new(original);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(original);
    let ext = path.extension().and_then(|e| e.to_str());

    let existing_names: Vec<&str> = existing.iter().map(|a| a.filename.as_str()).collect();

    let base = match ext {
        Some(e) => format!("{}.{}", stem, e),
        None => stem.to_string(),
    };

    if !existing_names.contains(&base.as_str()) {
        return base;
    }

    let mut counter = 2u32;
    loop {
        let candidate = match ext {
            Some(e) => format!("{}_{}.{}", stem, counter, e),
            None => format!("{}_{}", stem, counter),
        };
        if !existing_names.contains(&candidate.as_str()) {
            return candidate;
        }
        counter += 1;
    }
}

#[tauri::command]
pub fn add_attachment(
    issue_id: String,
    source_path: String,
    state: State<AppState>,
) -> CmdResult<Attachment> {
    let user = get_current_user_info(&state);
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    if project.format != StorageFormat::Directory {
        return Err("Attachments require directory storage format. Please migrate first.".to_string());
    }

    let idx = project
        .issues
        .iter()
        .position(|i| i.id == issue_id)
        .ok_or(format!("Issue {} not found", issue_id))?;

    let src = std::path::Path::new(&source_path);
    let original_filename = src
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid source file path")?
        .to_string();

    let filename = deduplicate_filename(&project.issues[idx].attachments, &original_filename);

    let size = storage::copy_attachment(
        src,
        &project.path,
        &project.issues[idx].issue_type,
        &project.issues[idx].uuid,
        &filename,
    )
    .map_err(map_err)?;

    let now = Utc::now();
    let att_num = project.issues[idx].attachments.len() + 1;
    let created_by = if user.provider != "anon" {
        Some(user.clone())
    } else {
        None
    };

    let attachment = Attachment {
        id: format!("att-{:04}", att_num),
        filename,
        size_bytes: size,
        created_at: now,
        created_by,
    };

    project.issues[idx].attachments.push(attachment.clone());
    project.issues[idx].history.push(HistoryEntry {
        action: "attachment_added".to_string(),
        from: None,
        to: Some(attachment.filename.clone()),
        user: user.clone(),
        timestamp: now,
    });
    project.issues[idx].updated_at = now;
    project.updated_at = now;

    let issue_clone = project.issues[idx].clone();
    save_single_issue(project, &issue_clone)?;

    Ok(attachment)
}

#[tauri::command]
pub fn remove_attachment(
    issue_id: String,
    attachment_id: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let user = get_current_user_info(&state);
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    if project.format != StorageFormat::Directory {
        return Err("Attachments require directory storage format.".to_string());
    }

    let idx = project
        .issues
        .iter()
        .position(|i| i.id == issue_id)
        .ok_or(format!("Issue {} not found", issue_id))?;

    let att_idx = project.issues[idx]
        .attachments
        .iter()
        .position(|a| a.id == attachment_id)
        .ok_or(format!("Attachment {} not found", attachment_id))?;

    let removed = project.issues[idx].attachments.remove(att_idx);

    storage::delete_attachment_file(
        &project.path,
        &project.issues[idx].issue_type,
        &project.issues[idx].uuid,
        &removed.filename,
    )
    .map_err(map_err)?;

    let now = Utc::now();
    project.issues[idx].history.push(HistoryEntry {
        action: "attachment_removed".to_string(),
        from: Some(removed.filename),
        to: None,
        user: user.clone(),
        timestamp: now,
    });
    project.issues[idx].updated_at = now;
    project.updated_at = now;

    let issue_clone = project.issues[idx].clone();
    save_single_issue(project, &issue_clone)?;

    Ok(())
}

#[tauri::command]
pub fn open_attachment(
    issue_id: String,
    attachment_id: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_ref().ok_or("No project is open")?;

    let issue = project
        .issues
        .iter()
        .find(|i| i.id == issue_id)
        .ok_or(format!("Issue {} not found", issue_id))?;

    let attachment = issue
        .attachments
        .iter()
        .find(|a| a.id == attachment_id)
        .ok_or(format!("Attachment {} not found", attachment_id))?;

    let path = storage::attachment_file_path(
        &project.path,
        &issue.issue_type,
        &issue.uuid,
        &attachment.filename,
    );

    if !path.exists() {
        return Err(format!(
            "Attachment file not found on disk: {}",
            path.display()
        ));
    }

    open::that(&path).map_err(|e| format!("Failed to open attachment: {}", e))?;
    Ok(())
}

fn mime_type_for_filename(filename: &str) -> &'static str {
    let ext = std::path::Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub fn get_attachment_data(
    issue_id: String,
    attachment_id: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_ref().ok_or("No project is open")?;

    let issue = project
        .issues
        .iter()
        .find(|i| i.id == issue_id)
        .ok_or(format!("Issue {} not found", issue_id))?;

    let attachment = issue
        .attachments
        .iter()
        .find(|a| a.id == attachment_id)
        .ok_or(format!("Attachment {} not found", attachment_id))?;

    let path = storage::attachment_file_path(
        &project.path,
        &issue.issue_type,
        &issue.uuid,
        &attachment.filename,
    );

    if !path.exists() {
        return Err(format!("Attachment file not found on disk: {}", path.display()));
    }

    let bytes = std::fs::read(&path).map_err(map_err)?;
    let mime = mime_type_for_filename(&attachment.filename);
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

// --- Color theme & other pass-through commands ---

#[tauri::command]
pub fn list_color_themes(state: State<AppState>) -> CmdResult<Vec<ColorTheme>> {
    state.db.list_color_themes().map_err(map_err)
}

#[tauri::command]
pub fn get_color_theme(id: String, state: State<AppState>) -> CmdResult<ColorTheme> {
    state.db.get_color_theme(&id).map_err(map_err)
}

#[tauri::command]
pub fn create_color_theme(theme: ColorTheme, state: State<AppState>) -> CmdResult<()> {
    state.db.create_color_theme(&theme).map_err(map_err)
}

#[tauri::command]
pub fn update_color_theme(theme: ColorTheme, state: State<AppState>) -> CmdResult<()> {
    state.db.update_color_theme(&theme).map_err(map_err)
}

#[tauri::command]
pub fn delete_color_theme(id: String, state: State<AppState>) -> CmdResult<()> {
    state.db.delete_color_theme(&id).map_err(map_err)
}

#[tauri::command]
pub fn update_recent_menu(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    recent_state: State<'_, RecentProjectPaths>,
) -> CmdResult<()> {
    let projects = state.db.list_projects().map_err(map_err)?;
    let recent: Vec<(String, String)> = projects
        .iter()
        .filter(|p| p.exists)
        .take(10)
        .map(|p| (p.name.clone(), p.path.clone()))
        .collect();

    *recent_state.0.lock().map_err(map_err)? = recent.clone();

    let menu = crate::build_app_menu(&app, &recent).map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn open_in_editor(editor: String, state: State<AppState>) -> CmdResult<()> {
    let active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_ref().ok_or("No project is open")?;
    let path = &project.path;

    let cmd = match editor.as_str() {
        "vscode" => "code",
        "cursor" => "cursor",
        "zed" => "zed",
        "sublime" => "subl",
        "webstorm" => "webstorm",
        "idea" => "idea",
        "atom" => "atom",
        "vim" | "neovim" => "nvim",
        other => other,
    };

    // On macOS, GUI apps don't inherit the user's shell PATH, so CLI tools
    // like `code` won't be found. Spawn via the user's login shell to get
    // the full PATH. We cd into the project dir and run `<editor> .` which
    // is the standard way to open a folder in most editors.
    #[cfg(target_os = "macos")]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        std::process::Command::new(&shell)
            .args(["-li", "-c", &format!("cd '{}' && {} .", path, cmd)])
            .spawn()
            .map_err(|e| format!("Failed to open editor '{}': {}. Make sure it's installed and available in your PATH.", cmd, e))?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        std::process::Command::new(cmd)
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open editor '{}': {}. Make sure it's installed and available in your PATH.", cmd, e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_in_terminal(state: State<AppState>) -> CmdResult<()> {
    let active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_ref().ok_or("No project is open")?;
    let path = &project.path;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-a")
            .arg("Terminal")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open Terminal: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", &format!("cd /d {}", path)])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try common terminal emulators in order
        let terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"];
        let mut opened = false;
        for term in &terminals {
            if std::process::Command::new(term)
                .arg("--working-directory")
                .arg(path)
                .spawn()
                .is_ok()
            {
                opened = true;
                break;
            }
        }
        if !opened {
            return Err("Could not find a terminal emulator".to_string());
        }
    }

    Ok(())
}
