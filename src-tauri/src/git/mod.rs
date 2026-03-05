use crate::commands::AppState;
use git2::{BranchType, Repository, Signature, Sort, StatusOptions};
use serde::Serialize;
use std::collections::HashMap;
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

/// Walk from HEAD back and collect commit hashes that are ahead of the
/// remote tracking branch for the current branch. Returns an empty vec
/// if there is no remote tracking branch or on any error.
fn compute_unpushed_hashes(repo: &Repository) -> Vec<String> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Vec::new(),
    };

    let branch_name = match head.shorthand() {
        Some(n) => n.to_string(),
        None => return Vec::new(),
    };

    let local_oid = match head.target() {
        Some(oid) => oid,
        None => return Vec::new(),
    };

    // Find the remote tracking branch (e.g. origin/<branch>)
    let local_branch = match repo.find_branch(&branch_name, BranchType::Local) {
        Ok(b) => b,
        Err(_) => return Vec::new(),
    };

    let upstream = match local_branch.upstream() {
        Ok(u) => u,
        Err(_) => return Vec::new(), // no remote tracking branch
    };

    let remote_oid = match upstream.get().target() {
        Some(oid) => oid,
        None => return Vec::new(),
    };

    if local_oid == remote_oid {
        return Vec::new(); // up to date
    }

    // Walk from HEAD, collecting commits until we reach the remote tip
    let mut revwalk = match repo.revwalk() {
        Ok(rw) => rw,
        Err(_) => return Vec::new(),
    };

    if revwalk.push(local_oid).is_err() {
        return Vec::new();
    }
    if revwalk.hide(remote_oid).is_err() {
        return Vec::new();
    }

    let mut hashes = Vec::new();
    for oid_result in revwalk {
        match oid_result {
            Ok(oid) => hashes.push(oid.to_string()),
            Err(_) => break,
        }
    }

    hashes
}

fn get_project_path(state: &AppState) -> CmdResult<String> {
    let guard = state.active_project.lock().map_err(map_err)?;
    guard
        .as_ref()
        .map(|p| p.path.clone())
        .ok_or_else(|| "No active project".to_string())
}

#[derive(Serialize, Clone)]
pub struct GitStatus {
    pub is_git_repo: bool,
    pub current_branch: String,
    pub repotrack_has_changes: bool,
    pub changed_files: Vec<String>,
    pub unpushed_hashes: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub last_commit_summary: String,
}

#[derive(Serialize, Clone)]
pub struct GitCommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
    pub parent_hashes: Vec<String>,
    pub refs: Vec<String>,
    pub is_merge: bool,
}

#[tauri::command]
pub fn git_get_status(state: State<'_, AppState>) -> CmdResult<GitStatus> {
    let path = get_project_path(&state)?;
    let repo = match Repository::discover(&path) {
        Ok(r) => r,
        Err(_) => {
            return Ok(GitStatus {
                is_git_repo: false,
                current_branch: String::new(),
                repotrack_has_changes: false,
                changed_files: Vec::new(),
                unpushed_hashes: Vec::new(),
            });
        }
    };

    let current_branch = match repo.head() {
        Ok(head) => head
            .shorthand()
            .unwrap_or("HEAD (detached)")
            .to_string(),
        Err(_) => "HEAD (detached)".to_string(),
    };

    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.pathspec(".repotrack");

    let statuses = repo.statuses(Some(&mut opts)).map_err(map_err)?;
    let mut changed_files = Vec::new();
    for entry in statuses.iter() {
        if let Some(p) = entry.path() {
            changed_files.push(p.to_string());
        }
    }

    // Find commits that are ahead of the remote tracking branch (unpushed)
    let unpushed_hashes = compute_unpushed_hashes(&repo);

    Ok(GitStatus {
        is_git_repo: true,
        current_branch,
        repotrack_has_changes: !changed_files.is_empty(),
        changed_files,
        unpushed_hashes,
    })
}

#[tauri::command]
pub fn git_get_branches(state: State<'_, AppState>) -> CmdResult<Vec<GitBranch>> {
    let path = get_project_path(&state)?;
    let repo = Repository::discover(&path).map_err(map_err)?;

    let head_ref = repo.head().ok();
    let head_name = head_ref
        .as_ref()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    let mut branches = Vec::new();

    // Local branches
    for branch_result in repo.branches(Some(BranchType::Local)).map_err(map_err)? {
        let (branch, _bt) = branch_result.map_err(map_err)?;
        let name = branch
            .name()
            .map_err(map_err)?
            .unwrap_or("unknown")
            .to_string();
        let is_current = head_name.as_deref() == Some(&name);
        let last_commit_summary = branch
            .get()
            .peel_to_commit()
            .ok()
            .map(|c| c.summary().unwrap_or("").to_string())
            .unwrap_or_default();

        branches.push(GitBranch {
            name,
            is_current,
            is_remote: false,
            last_commit_summary,
        });
    }

    // Remote branches
    for branch_result in repo.branches(Some(BranchType::Remote)).map_err(map_err)? {
        let (branch, _bt) = branch_result.map_err(map_err)?;
        let name = branch
            .name()
            .map_err(map_err)?
            .unwrap_or("unknown")
            .to_string();
        // Skip HEAD refs like "origin/HEAD"
        if name.ends_with("/HEAD") {
            continue;
        }
        let last_commit_summary = branch
            .get()
            .peel_to_commit()
            .ok()
            .map(|c| c.summary().unwrap_or("").to_string())
            .unwrap_or_default();

        branches.push(GitBranch {
            name,
            is_current: false,
            is_remote: true,
            last_commit_summary,
        });
    }

    Ok(branches)
}

#[tauri::command]
pub fn git_get_log(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> CmdResult<Vec<GitCommitInfo>> {
    let path = get_project_path(&state)?;
    let repo = Repository::discover(&path).map_err(map_err)?;

    let limit = limit.unwrap_or(200);

    // Read current git config user.name and user.email so we can normalize
    // author names — old commits may have a stale username but the same email.
    let config = repo.config().ok().and_then(|mut c| c.snapshot().ok());
    let config_name = config
        .as_ref()
        .and_then(|c| c.get_str("user.name").ok())
        .unwrap_or("")
        .to_string();
    let config_email = config
        .as_ref()
        .and_then(|c| c.get_str("user.email").ok())
        .unwrap_or("")
        .to_string();

    // Build a map of oid -> ref names for display
    let mut ref_map: HashMap<git2::Oid, Vec<String>> = HashMap::new();
    for reference in repo.references().map_err(map_err)? {
        let reference = reference.map_err(map_err)?;
        if let Some(name) = reference.shorthand() {
            if let Ok(target) = reference.peel_to_commit() {
                ref_map
                    .entry(target.id())
                    .or_default()
                    .push(name.to_string());
            }
        }
    }

    let mut revwalk = repo.revwalk().map_err(map_err)?;
    revwalk.push_head().map_err(map_err)?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL).map_err(map_err)?;

    // Also walk all branches so we get a complete graph
    for branch_result in repo.branches(Some(BranchType::Local)).map_err(map_err)? {
        let (branch, _) = branch_result.map_err(map_err)?;
        if let Ok(commit) = branch.get().peel_to_commit() {
            let _ = revwalk.push(commit.id());
        }
    }

    let mut commits = Vec::new();
    for oid_result in revwalk.take(limit) {
        let oid = oid_result.map_err(map_err)?;
        let commit = repo.find_commit(oid).map_err(map_err)?;

        let hash = oid.to_string();
        let short_hash = hash[..7.min(hash.len())].to_string();
        let message = commit.summary().unwrap_or("").to_string();
        let author_email = commit.author().email().unwrap_or("").to_string();
        // If the commit's author email matches the current git config email,
        // show the current config name instead of the potentially stale one
        // stored in the commit object.
        let author = if !config_email.is_empty()
            && !config_name.is_empty()
            && author_email.eq_ignore_ascii_case(&config_email)
        {
            config_name.clone()
        } else {
            commit.author().name().unwrap_or("unknown").to_string()
        };
        let timestamp = commit.time().seconds();
        let parent_hashes: Vec<String> = commit
            .parent_ids()
            .map(|id| id.to_string())
            .collect();
        let refs = ref_map.get(&oid).cloned().unwrap_or_default();
        let is_merge = commit.parent_count() > 1;

        commits.push(GitCommitInfo {
            hash,
            short_hash,
            message,
            author,
            timestamp,
            parent_hashes,
            refs,
            is_merge,
        });
    }

    Ok(commits)
}

#[tauri::command]
pub fn git_checkout_branch(state: State<'_, AppState>, name: String) -> CmdResult<()> {
    let path = get_project_path(&state)?;
    let repo = Repository::discover(&path).map_err(map_err)?;

    let (object, reference) = repo.revparse_ext(&name).map_err(map_err)?;
    repo.checkout_tree(&object, None).map_err(map_err)?;

    match reference {
        Some(r) => {
            let refname = r.name().ok_or("Invalid reference name")?;
            repo.set_head(refname).map_err(map_err)?;
        }
        None => {
            repo.set_head_detached(object.id()).map_err(map_err)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn git_commit_repotrack(
    state: State<'_, AppState>,
    message: String,
) -> CmdResult<GitCommitInfo> {
    let path = get_project_path(&state)?;
    let repo = Repository::discover(&path).map_err(map_err)?;

    let mut index = repo.index().map_err(map_err)?;

    // Only add .repotrack files
    index
        .add_all([".repotrack"], git2::IndexAddOption::DEFAULT, None)
        .map_err(map_err)?;
    // Also handle deleted .repotrack files
    index
        .update_all([".repotrack"], None)
        .map_err(map_err)?;
    index.write().map_err(map_err)?;

    let tree_id = index.write_tree().map_err(map_err)?;
    let tree = repo.find_tree(tree_id).map_err(map_err)?;

    let sig = repo
        .signature()
        .or_else(|_| Signature::now("RepoTrack User", "repotrack@localhost"))
        .map_err(map_err)?;

    let parent_commit = repo
        .head()
        .map_err(map_err)?
        .peel_to_commit()
        .map_err(map_err)?;

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent_commit])
        .map_err(map_err)?;

    let commit = repo.find_commit(oid).map_err(map_err)?;
    let hash = oid.to_string();
    let short_hash = hash[..7.min(hash.len())].to_string();
    let msg = commit.summary().unwrap_or("").to_string();
    let author = commit.author().name().unwrap_or("unknown").to_string();
    let timestamp = commit.time().seconds();
    let parent_hashes: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();

    Ok(GitCommitInfo {
        hash,
        short_hash,
        message: msg,
        author,
        timestamp,
        parent_hashes,
        refs: Vec::new(),
        is_merge: false,
    })
}

#[tauri::command]
pub fn git_undo_commit(state: State<'_, AppState>) -> CmdResult<()> {
    let path = get_project_path(&state)?;
    let repo = Repository::discover(&path).map_err(map_err)?;

    let head = repo.head().map_err(map_err)?;
    let head_commit = head.peel_to_commit().map_err(map_err)?;

    // Don't undo merge commits
    if head_commit.parent_count() > 1 {
        return Err("Cannot undo a merge commit".to_string());
    }

    // Must have a parent (not the initial commit)
    if head_commit.parent_count() == 0 {
        return Err("Cannot undo the initial commit".to_string());
    }

    // HEAD must be unpushed
    let unpushed = compute_unpushed_hashes(&repo);
    if !unpushed.contains(&head_commit.id().to_string()) {
        return Err("Cannot undo a commit that has already been pushed".to_string());
    }

    let parent = head_commit.parent(0).map_err(map_err)?;
    repo.reset(parent.as_object(), git2::ResetType::Soft, None)
        .map_err(map_err)?;

    Ok(())
}

#[tauri::command]
pub fn git_push(state: State<'_, AppState>) -> CmdResult<()> {
    let path = get_project_path(&state)?;
    let repo = Repository::discover(&path).map_err(map_err)?;
    let workdir = repo
        .workdir()
        .ok_or("Cannot determine repository working directory")?;

    // Shell out to system git for push — it handles credential helpers
    // (macOS Keychain, GitHub CLI, git-credential-manager, etc.) automatically,
    // whereas git2's credential callback struggles with HTTPS auth.
    let output = std::process::Command::new("git")
        .args(["push"])
        .current_dir(workdir)
        .output()
        .map_err(|e| format!("Failed to run git push: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git push failed: {}", stderr.trim()));
    }

    Ok(())
}
