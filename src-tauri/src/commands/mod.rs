use crate::db::Database;
use crate::models::*;
use crate::stats::compute_stats;
use crate::storage;
use chrono::Utc;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub db: Database,
    pub active_project: Mutex<Option<ActiveProject>>,
}

pub struct ActiveProject {
    pub path: String,
    pub data: RepoTrackFile,
}

type CmdResult<T> = Result<T, String>;

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
pub fn list_recent_projects(state: State<AppState>) -> CmdResult<Vec<ProjectInfo>> {
    let mut projects = state.db.list_projects().map_err(map_err)?;
    for project in &mut projects {
        let rt_path = storage::repotrack_path(&project.path);
        if rt_path.exists() {
            if let Ok(data) = storage::read_repotrack_file(&rt_path) {
                project.open_issues = data.issues.iter().filter(|i| {
                    i.status == "open" || i.status == "in-progress"
                        || i.status == "proposed" || i.status == "under-review"
                        || i.status == "planned"
                }).count() as i32;
                project.name = data.project_name.clone();
            }
        }
    }
    Ok(projects)
}

#[tauri::command]
pub fn open_project(path: String, state: State<AppState>) -> CmdResult<RepoTrackFile> {
    let rt_path = storage::repotrack_path(&path);
    if !storage::file_exists(&rt_path) {
        return Err(format!("No repotrack.json found at {}", path));
    }
    let data = storage::read_repotrack_file(&rt_path).map_err(map_err)?;
    state.db.update_last_opened(&path).map_err(map_err)?;

    let mut active = state.active_project.lock().map_err(map_err)?;
    *active = Some(ActiveProject {
        path: path.clone(),
        data: data.clone(),
    });
    Ok(data)
}

#[tauri::command]
pub fn create_project(path: String, name: String, state: State<AppState>) -> CmdResult<RepoTrackFile> {
    let rt_path = storage::repotrack_path(&path);
    let data = RepoTrackFile::new(name.clone());
    storage::write_repotrack_file(&rt_path, &data).map_err(map_err)?;
    state.db.add_project(&name, &path).map_err(map_err)?;

    let mut active = state.active_project.lock().map_err(map_err)?;
    *active = Some(ActiveProject {
        path: path.clone(),
        data: data.clone(),
    });
    Ok(data)
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
        Some(project) => Ok(project.data.issues.clone()),
        None => Err("No project is open".to_string()),
    }
}

#[tauri::command]
pub fn create_issue(request: CreateIssueRequest, state: State<AppState>) -> CmdResult<Issue> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let now = Utc::now();
    let id = project.data.next_id(&request.issue_type);
    let default_status = match request.issue_type {
        IssueType::Bug => "open".to_string(),
        IssueType::Feature => "proposed".to_string(),
        IssueType::Improvement => "open".to_string(),
        IssueType::Task => "open".to_string(),
    };

    let issue = Issue {
        id: id.clone(),
        title: request.title,
        description: request.description,
        issue_type: request.issue_type.clone(),
        severity: if matches!(request.issue_type, IssueType::Bug | IssueType::Improvement | IssueType::Task) {
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
        votes: if request.issue_type == IssueType::Feature { Some(0) } else { None },
        roadmap_quarter: request.roadmap_quarter,
        comments: Vec::new(),
        linked_files: request.linked_files,
        time_estimate_hours: request.time_estimate_hours,
        time_spent_hours: None,
    };

    project.data.issues.push(issue.clone());
    project.data.updated_at = now;

    let rt_path = storage::repotrack_path(&project.path);
    storage::write_repotrack_file(&rt_path, &project.data).map_err(map_err)?;

    let type_str = format!("{:?}", request.issue_type).to_lowercase();
    let _ = state.db.log_activity(&project.path, &id, &issue.title, &type_str, "created");

    Ok(issue)
}

#[tauri::command]
pub fn update_issue(request: UpdateIssueRequest, state: State<AppState>) -> CmdResult<Issue> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let issue = project.data.issues.iter_mut()
        .find(|i| i.id == request.id)
        .ok_or(format!("Issue {} not found", request.id))?;

    let now = Utc::now();
    let old_status = issue.status.clone();

    if let Some(title) = request.title { issue.title = title; }
    if let Some(desc) = request.description { issue.description = desc; }
    if let Some(sev) = request.severity { issue.severity = Some(sev); }
    if let Some(pri) = request.priority { issue.priority = Some(pri); }
    if let Some(status) = request.status.clone() {
        issue.status = status.clone();
        if (status == "resolved" || status == "closed" || status == "completed") && issue.resolved_at.is_none() {
            issue.resolved_at = Some(now);
        }
        if status == "open" || status == "in-progress" || status == "proposed" || status == "planned" {
            issue.resolved_at = None;
        }
    }
    if let Some(tags) = request.tags { issue.tags = tags; }
    if let Some(str) = request.steps_to_reproduce { issue.steps_to_reproduce = Some(str); }
    if let Some(eb) = request.expected_behavior { issue.expected_behavior = Some(eb); }
    if let Some(ab) = request.actual_behavior { issue.actual_behavior = Some(ab); }
    if let Some(env) = request.environment { issue.environment = Some(env); }
    if let Some(uc) = request.use_case { issue.use_case = Some(uc); }
    if let Some(ac) = request.acceptance_criteria { issue.acceptance_criteria = Some(ac); }
    if let Some(rq) = request.roadmap_quarter { issue.roadmap_quarter = Some(rq); }
    if let Some(lf) = request.linked_files { issue.linked_files = lf; }
    if let Some(te) = request.time_estimate_hours { issue.time_estimate_hours = Some(te); }
    if let Some(ts) = request.time_spent_hours { issue.time_spent_hours = Some(ts); }
    if let Some(v) = request.votes { issue.votes = Some(v); }
    if let Some(ra) = request.resolved_at { issue.resolved_at = ra; }

    issue.updated_at = now;
    project.data.updated_at = now;

    let result = issue.clone();
    let rt_path = storage::repotrack_path(&project.path);
    storage::write_repotrack_file(&rt_path, &project.data).map_err(map_err)?;

    if let Some(ref new_status) = request.status {
        if *new_status != old_status {
            let action = format!("status changed from {} to {}", old_status, new_status);
            let type_str = format!("{:?}", result.issue_type).to_lowercase();
            let _ = state.db.log_activity(&project.path, &result.id, &result.title, &type_str, &action);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn delete_issue(id: String, state: State<AppState>) -> CmdResult<()> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let idx = project.data.issues.iter().position(|i| i.id == id)
        .ok_or(format!("Issue {} not found", id))?;
    let removed = project.data.issues.remove(idx);
    project.data.updated_at = Utc::now();

    let rt_path = storage::repotrack_path(&project.path);
    storage::write_repotrack_file(&rt_path, &project.data).map_err(map_err)?;

    let type_str = format!("{:?}", removed.issue_type).to_lowercase();
    let _ = state.db.log_activity(&project.path, &id, &removed.title, &type_str, "deleted");

    Ok(())
}

#[tauri::command]
pub fn bulk_update_issues(request: BulkUpdateRequest, state: State<AppState>) -> CmdResult<Vec<Issue>> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let now = Utc::now();
    let mut updated = Vec::new();

    for issue in project.data.issues.iter_mut() {
        if request.ids.contains(&issue.id) {
            if let Some(ref status) = request.status {
                issue.status = status.clone();
                if status == "resolved" || status == "closed" || status == "completed" {
                    if issue.resolved_at.is_none() {
                        issue.resolved_at = Some(now);
                    }
                }
            }
            if let Some(ref sev) = request.severity { issue.severity = Some(sev.clone()); }
            if let Some(ref pri) = request.priority { issue.priority = Some(pri.clone()); }
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
    project.data.updated_at = now;

    let rt_path = storage::repotrack_path(&project.path);
    storage::write_repotrack_file(&rt_path, &project.data).map_err(map_err)?;

    Ok(updated)
}

#[tauri::command]
pub fn add_comment(issue_id: String, text: String, state: State<AppState>) -> CmdResult<Comment> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let idx = project.data.issues.iter().position(|i| i.id == issue_id)
        .ok_or(format!("Issue {} not found", issue_id))?;

    let now = Utc::now();
    let comment_num = project.data.issues[idx].comments.len() + 1;
    let comment = Comment {
        id: format!("CMT-{:04}", comment_num),
        text,
        created_at: now,
    };

    project.data.issues[idx].comments.push(comment.clone());
    project.data.issues[idx].updated_at = now;
    project.data.updated_at = now;

    let rt_path = storage::repotrack_path(&project.path);
    storage::write_repotrack_file(&rt_path, &project.data).map_err(map_err)?;

    let type_str = format!("{:?}", project.data.issues[idx].issue_type).to_lowercase();
    let title = project.data.issues[idx].title.clone();
    let _ = state.db.log_activity(&project.path, &issue_id, &title, &type_str, "comment added");

    Ok(comment)
}

#[tauri::command]
pub fn vote_issue(issue_id: String, state: State<AppState>) -> CmdResult<i32> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    let idx = project.data.issues.iter().position(|i| i.id == issue_id)
        .ok_or(format!("Issue {} not found", issue_id))?;

    let new_votes = project.data.issues[idx].votes.unwrap_or(0) + 1;
    project.data.issues[idx].votes = Some(new_votes);
    project.data.issues[idx].updated_at = Utc::now();
    project.data.updated_at = Utc::now();

    let rt_path = storage::repotrack_path(&project.path);
    storage::write_repotrack_file(&rt_path, &project.data).map_err(map_err)?;

    Ok(new_votes)
}

#[tauri::command]
pub fn get_project_stats(state: State<AppState>) -> CmdResult<ProjectStats> {
    let active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_ref().ok_or("No project is open")?;

    let activity = state.db.get_activity(&project.path, 50).map_err(map_err)?;
    Ok(compute_stats(&project.data, activity))
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

    project.data.project_name = name;
    project.data.updated_at = Utc::now();

    let rt_path = storage::repotrack_path(&project.path);
    storage::write_repotrack_file(&rt_path, &project.data).map_err(map_err)?;
    Ok(())
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
    Ok(active.as_ref().map(|p| p.data.clone()))
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
        "ID", "Title", "Type", "Status", "Severity", "Priority",
        "Tags", "Created", "Updated", "Resolved", "Votes",
        "Time Estimate", "Time Spent", "Description",
    ]).map_err(map_err)?;

    for issue in &project.data.issues {
        wtr.write_record(&[
            &issue.id,
            &issue.title,
            &format!("{:?}", issue.issue_type).to_lowercase(),
            &issue.status,
            &issue.severity.as_ref().map(|s| format!("{:?}", s).to_lowercase()).unwrap_or_default(),
            &issue.priority.as_ref().map(|p| format!("{:?}", p).to_lowercase()).unwrap_or_default(),
            &issue.tags.join(", "),
            &issue.created_at.to_rfc3339(),
            &issue.updated_at.to_rfc3339(),
            &issue.resolved_at.map(|r| r.to_rfc3339()).unwrap_or_default(),
            &issue.votes.map(|v| v.to_string()).unwrap_or_default(),
            &issue.time_estimate_hours.map(|t| t.to_string()).unwrap_or_default(),
            &issue.time_spent_hours.map(|t| t.to_string()).unwrap_or_default(),
            &issue.description,
        ]).map_err(map_err)?;
    }
    wtr.flush().map_err(map_err)?;
    Ok(())
}

#[tauri::command]
pub fn export_markdown(path: String, state: State<AppState>) -> CmdResult<()> {
    let active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_ref().ok_or("No project is open")?;

    let mut content = format!("# {} — Issue Tracker\n\n", project.data.project_name);
    content.push_str(&format!("Generated: {}\n\n", Utc::now().format("%Y-%m-%d %H:%M UTC")));

    let bugs: Vec<&Issue> = project.data.issues.iter().filter(|i| i.issue_type == IssueType::Bug).collect();
    let features: Vec<&Issue> = project.data.issues.iter().filter(|i| i.issue_type == IssueType::Feature).collect();
    let others: Vec<&Issue> = project.data.issues.iter().filter(|i| {
        i.issue_type != IssueType::Bug && i.issue_type != IssueType::Feature
    }).collect();

    if !bugs.is_empty() {
        content.push_str("## Bugs\n\n");
        for bug in &bugs {
            content.push_str(&format!("### {} — {}\n\n", bug.id, bug.title));
            content.push_str(&format!("**Status:** {} | **Severity:** {}\n\n",
                bug.status,
                bug.severity.as_ref().map(|s| format!("{:?}", s).to_lowercase()).unwrap_or_default()));
            if !bug.description.is_empty() {
                content.push_str(&format!("{}\n\n", bug.description));
            }
        }
    }

    if !features.is_empty() {
        content.push_str("## Feature Requests\n\n");
        for feat in &features {
            content.push_str(&format!("### {} — {}\n\n", feat.id, feat.title));
            content.push_str(&format!("**Status:** {} | **Priority:** {} | **Votes:** {}\n\n",
                feat.status,
                feat.priority.as_ref().map(|p| format!("{:?}", p).to_lowercase()).unwrap_or_default(),
                feat.votes.unwrap_or(0)));
            if !feat.description.is_empty() {
                content.push_str(&format!("{}\n\n", feat.description));
            }
        }
    }

    if !others.is_empty() {
        content.push_str("## Other Issues\n\n");
        for issue in &others {
            content.push_str(&format!("### {} — {}\n\n", issue.id, issue.title));
            content.push_str(&format!("**Type:** {:?} | **Status:** {}\n\n",
                issue.issue_type, issue.status));
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
    let project = active.as_mut().ok_or("No project is open")?;

    let rt_path = storage::repotrack_path(&project.path);
    let data = storage::read_repotrack_file(&rt_path).map_err(map_err)?;
    project.data = data.clone();
    Ok(data)
}

#[tauri::command]
pub fn delete_all_issues(issue_type: Option<String>, state: State<AppState>) -> CmdResult<()> {
    let mut active = state.active_project.lock().map_err(map_err)?;
    let project = active.as_mut().ok_or("No project is open")?;

    match issue_type.as_deref() {
        Some("bug") => project.data.issues.retain(|i| i.issue_type != IssueType::Bug),
        Some("feature") => project.data.issues.retain(|i| i.issue_type != IssueType::Feature),
        _ => project.data.issues.clear(),
    }
    project.data.updated_at = Utc::now();

    let rt_path = storage::repotrack_path(&project.path);
    storage::write_repotrack_file(&rt_path, &project.data).map_err(map_err)?;
    Ok(())
}
