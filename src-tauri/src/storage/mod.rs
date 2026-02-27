use crate::models::RepoTrackFile;
use anyhow::Result;
use std::path::{Path, PathBuf};

pub fn read_repotrack_file(path: &Path) -> Result<RepoTrackFile> {
    let content = std::fs::read_to_string(path)?;
    let data: RepoTrackFile = serde_json::from_str(&content)?;
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
