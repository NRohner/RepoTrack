use crate::models::{Issue, IssueType, ProjectMetadata, RepoTrackFile, StorageFormat, REPOTRACK_NOTICE};
use anyhow::Result;
use std::path::{Path, PathBuf};

// --- Legacy format helpers (kept for backwards compatibility) ---

pub fn read_repotrack_file(path: &Path) -> Result<RepoTrackFile> {
    let content = std::fs::read_to_string(path)?;
    let mut data: RepoTrackFile = serde_json::from_str(&content)?;
    let needs_update = !content.contains("\"_repotrack\"")
        || data._repotrack != REPOTRACK_NOTICE
        || data.version != env!("CARGO_PKG_VERSION");
    if needs_update {
        data._repotrack = REPOTRACK_NOTICE.to_string();
        data.version = env!("CARGO_PKG_VERSION").to_string();
        write_repotrack_file(path, &data)?;
    }
    Ok(data)
}

pub fn write_repotrack_file(path: &Path, data: &RepoTrackFile) -> Result<()> {
    let content = serde_json::to_string_pretty(data)?;
    std::fs::write(path, content)?;
    Ok(())
}

pub fn repotrack_path(project_dir: &str) -> PathBuf {
    Path::new(project_dir).join("repotrack.json")
}

pub fn file_exists(path: &Path) -> bool {
    path.exists() && path.is_file()
}

// --- Directory format path helpers ---

pub fn repotrack_dir(project_dir: &str) -> PathBuf {
    Path::new(project_dir).join(".repotrack")
}

pub fn project_metadata_path(project_dir: &str) -> PathBuf {
    repotrack_dir(project_dir).join("project.json")
}

pub fn issues_dir(project_dir: &str) -> PathBuf {
    repotrack_dir(project_dir).join("issues")
}

fn issue_type_prefix(issue_type: &IssueType) -> &'static str {
    match issue_type {
        IssueType::Bug => "bug",
        IssueType::Feature => "feat",
        IssueType::Improvement => "imp",
        IssueType::Task => "task",
    }
}

pub fn issue_dir_path(project_dir: &str, issue_type: &IssueType, uuid: &str) -> PathBuf {
    issues_dir(project_dir).join(format!("{}-{}", issue_type_prefix(issue_type), uuid))
}

pub fn issue_file_path(project_dir: &str, issue_type: &IssueType, uuid: &str) -> PathBuf {
    issue_dir_path(project_dir, issue_type, uuid).join("issue.json")
}

// --- Format detection ---

pub fn detect_format(project_dir: &str) -> Option<StorageFormat> {
    if project_metadata_path(project_dir).exists() {
        Some(StorageFormat::Directory)
    } else if repotrack_path(project_dir).exists() {
        Some(StorageFormat::Legacy)
    } else {
        None
    }
}

// --- Directory format I/O ---

pub fn read_project_metadata(project_dir: &str) -> Result<ProjectMetadata> {
    let path = project_metadata_path(project_dir);
    let content = std::fs::read_to_string(&path)?;
    let mut meta: ProjectMetadata = serde_json::from_str(&content)?;
    // Auto-update version and notice
    if meta._repotrack != REPOTRACK_NOTICE || meta.version != env!("CARGO_PKG_VERSION") {
        meta._repotrack = REPOTRACK_NOTICE.to_string();
        meta.version = env!("CARGO_PKG_VERSION").to_string();
        write_project_metadata(project_dir, &meta)?;
    }
    Ok(meta)
}

pub fn write_project_metadata(project_dir: &str, meta: &ProjectMetadata) -> Result<()> {
    let path = project_metadata_path(project_dir);
    std::fs::create_dir_all(path.parent().unwrap())?;
    let content = serde_json::to_string_pretty(meta)?;
    std::fs::write(path, content)?;
    Ok(())
}

pub fn read_all_issues(project_dir: &str) -> Result<Vec<Issue>> {
    let dir = issues_dir(project_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut issues = Vec::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        if !entry.metadata()?.is_dir() {
            continue;
        }
        let issue_json = entry.path().join("issue.json");
        if !issue_json.exists() {
            continue; // empty directory, skip silently
        }
        match std::fs::read_to_string(&issue_json) {
            Ok(content) => match serde_json::from_str::<Issue>(&content) {
                Ok(issue) => issues.push(issue),
                Err(e) => {
                    eprintln!(
                        "Warning: corrupt issue.json at {}: {}",
                        issue_json.display(),
                        e
                    );
                }
            },
            Err(e) => {
                eprintln!(
                    "Warning: could not read {}: {}",
                    issue_json.display(),
                    e
                );
            }
        }
    }
    issues.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(issues)
}

pub fn write_issue(project_dir: &str, issue: &Issue) -> Result<()> {
    let dir = issue_dir_path(project_dir, &issue.issue_type, &issue.uuid);
    std::fs::create_dir_all(&dir)?;
    let file = dir.join("issue.json");
    let content = serde_json::to_string_pretty(issue)?;
    std::fs::write(file, content)?;
    Ok(())
}

pub fn delete_issue_dir(project_dir: &str, issue_type: &IssueType, uuid: &str) -> Result<()> {
    let dir = issue_dir_path(project_dir, issue_type, uuid);
    if dir.exists() {
        std::fs::remove_dir_all(dir)?;
    }
    Ok(())
}

pub fn create_directory_structure(project_dir: &str) -> Result<()> {
    std::fs::create_dir_all(issues_dir(project_dir))?;
    Ok(())
}

// --- Attachment helpers ---

pub fn attachments_dir(project_dir: &str, issue_type: &IssueType, uuid: &str) -> PathBuf {
    issue_dir_path(project_dir, issue_type, uuid).join("attachments")
}

pub fn attachment_file_path(
    project_dir: &str,
    issue_type: &IssueType,
    uuid: &str,
    filename: &str,
) -> PathBuf {
    attachments_dir(project_dir, issue_type, uuid).join(filename)
}

pub fn copy_attachment(
    source_path: &Path,
    project_dir: &str,
    issue_type: &IssueType,
    uuid: &str,
    filename: &str,
) -> Result<u64> {
    let dir = attachments_dir(project_dir, issue_type, uuid);
    std::fs::create_dir_all(&dir)?;
    let dest = dir.join(filename);
    std::fs::copy(source_path, &dest)?;
    let size = std::fs::metadata(&dest)?.len();
    Ok(size)
}

pub fn delete_attachment_file(
    project_dir: &str,
    issue_type: &IssueType,
    uuid: &str,
    filename: &str,
) -> Result<()> {
    let path = attachment_file_path(project_dir, issue_type, uuid, filename);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

// --- Existing directory listing ---

pub fn list_directory(dir: &str) -> Result<Vec<DirEntry>> {
    let mut entries = Vec::new();
    let path = Path::new(dir);
    if !path.is_dir() {
        return Ok(entries);
    }
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });
    Ok(entries)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}
