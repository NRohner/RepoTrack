use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

use crate::models::{ProjectInfo, UserPreferences};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(data_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(data_dir)?;
        let db_path = data_dir.join("repotrack.db");
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_path TEXT NOT NULL,
                issue_id TEXT NOT NULL,
                issue_title TEXT NOT NULL,
                issue_type TEXT NOT NULL,
                action TEXT NOT NULL,
                timestamp TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (project_path) REFERENCES projects(path)
            );
            ",
        )?;
        Ok(())
    }

    pub fn add_project(&self, name: &str, path: &str) -> Result<ProjectInfo> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR REPLACE INTO projects (id, name, path, created_at, last_opened) VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
            rusqlite::params![id, name, path],
        )?;
        Ok(ProjectInfo {
            id,
            name: name.to_string(),
            path: path.to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            last_opened: chrono::Utc::now().to_rfc3339(),
            open_issues: 0,
            exists: true,
        })
    }

    pub fn update_last_opened(&self, path: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute(
            "UPDATE projects SET last_opened = datetime('now') WHERE path = ?1",
            rusqlite::params![path],
        )?;
        Ok(())
    }

    pub fn list_projects(&self) -> Result<Vec<ProjectInfo>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, path, created_at, last_opened FROM projects ORDER BY last_opened DESC",
        )?;
        let projects = stmt.query_map([], |row| {
            let path: String = row.get(2)?;
            let exists = std::path::Path::new(&path)
                .join("repotrack.json")
                .exists();
            Ok(ProjectInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                path,
                created_at: row.get(3)?,
                last_opened: row.get(4)?,
                open_issues: 0,
                exists,
            })
        })?;
        let mut result = Vec::new();
        for p in projects {
            result.push(p?);
        }
        Ok(result)
    }

    pub fn remove_project(&self, path: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute("DELETE FROM projects WHERE path = ?1", rusqlite::params![path])?;
        conn.execute(
            "DELETE FROM activity_log WHERE project_path = ?1",
            rusqlite::params![path],
        )?;
        Ok(())
    }

    pub fn log_activity(
        &self,
        project_path: &str,
        issue_id: &str,
        issue_title: &str,
        issue_type: &str,
        action: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute(
            "INSERT INTO activity_log (project_path, issue_id, issue_title, issue_type, action) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![project_path, issue_id, issue_title, issue_type, action],
        )?;
        Ok(())
    }

    pub fn get_activity(
        &self,
        project_path: &str,
        limit: usize,
    ) -> Result<Vec<crate::models::ActivityEntry>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let mut stmt = conn.prepare(
            "SELECT issue_id, issue_title, action, issue_type, timestamp FROM activity_log WHERE project_path = ?1 ORDER BY timestamp DESC LIMIT ?2",
        )?;
        let entries = stmt.query_map(rusqlite::params![project_path, limit], |row| {
            Ok(crate::models::ActivityEntry {
                issue_id: row.get(0)?,
                issue_title: row.get(1)?,
                action: row.get(2)?,
                issue_type: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })?;
        let mut result = Vec::new();
        for e in entries {
            result.push(e?);
        }
        Ok(result)
    }

    pub fn get_preferences(&self) -> Result<UserPreferences> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let mut prefs = UserPreferences::default();
        let mut stmt = conn.prepare("SELECT key, value FROM preferences")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows {
            let (key, value) = row?;
            match key.as_str() {
                "theme" => prefs.theme = value,
                "default_view" => prefs.default_view = value,
                "default_layout" => prefs.default_layout = value,
                "default_status_filter" => prefs.default_status_filter = Some(value),
                "default_severity_filter" => prefs.default_severity_filter = Some(value),
                _ => {}
            }
        }
        Ok(prefs)
    }

    pub fn update_preferences(&self, prefs: &UserPreferences) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let pairs = vec![
            ("theme", &prefs.theme),
            ("default_view", &prefs.default_view),
            ("default_layout", &prefs.default_layout),
        ];
        for (key, value) in pairs {
            conn.execute(
                "INSERT OR REPLACE INTO preferences (key, value) VALUES (?1, ?2)",
                rusqlite::params![key, value],
            )?;
        }
        if let Some(ref v) = prefs.default_status_filter {
            conn.execute(
                "INSERT OR REPLACE INTO preferences (key, value) VALUES ('default_status_filter', ?1)",
                rusqlite::params![v],
            )?;
        }
        if let Some(ref v) = prefs.default_severity_filter {
            conn.execute(
                "INSERT OR REPLACE INTO preferences (key, value) VALUES ('default_severity_filter', ?1)",
                rusqlite::params![v],
            )?;
        }
        Ok(())
    }
}
