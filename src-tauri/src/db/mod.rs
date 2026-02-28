use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

use crate::models::{ColorPalette, ColorTheme, ProjectInfo, UserInfo, UserPreferences};

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

            CREATE TABLE IF NOT EXISTS color_themes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_builtin INTEGER NOT NULL DEFAULT 0,
                accent_palette TEXT NOT NULL,
                surface_palette TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS auth_tokens (
                provider TEXT PRIMARY KEY,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                token_expiry TEXT,
                user_display_name TEXT NOT NULL,
                user_username TEXT NOT NULL,
                user_avatar_url TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            ",
        )?;

        // Seed default theme
        conn.execute(
            "INSERT OR IGNORE INTO color_themes (id, name, is_builtin, accent_palette, surface_palette) VALUES (?1, ?2, 1, ?3, ?4)",
            rusqlite::params![
                "default-indigo",
                "Default",
                r##"{"50":"#eef2ff","100":"#e0e7ff","200":"#c7d2fe","300":"#a5b4fc","400":"#818cf8","500":"#6366f1","600":"#4f46e5","700":"#4338ca","800":"#3730a3","900":"#312e81","950":"#1e1b4b"}"##,
                r##"{"50":"#f8fafc","100":"#f1f5f9","200":"#e2e8f0","300":"#cbd5e1","400":"#94a3b8","500":"#64748b","600":"#475569","700":"#334155","800":"#1e293b","900":"#0f172a","950":"#0a0a14"}"##,
            ],
        )?;

        // Rename "Indigo" -> "Default" for existing databases
        conn.execute(
            "UPDATE color_themes SET name = 'Default' WHERE id = 'default-indigo' AND name = 'Indigo'",
            [],
        )?;

        // Migrate activity_log: add user_display_name column if missing
        let has_user_col: bool = conn
            .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='activity_log'")?
            .query_row([], |row| row.get::<_, String>(0))
            .map(|sql| sql.contains("user_display_name"))
            .unwrap_or(false);
        if !has_user_col {
            conn.execute_batch(
                "ALTER TABLE activity_log ADD COLUMN user_display_name TEXT NOT NULL DEFAULT 'anon';",
            )?;
        }

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
        user_display_name: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute(
            "INSERT INTO activity_log (project_path, issue_id, issue_title, issue_type, action, user_display_name) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![project_path, issue_id, issue_title, issue_type, action, user_display_name],
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
            "SELECT issue_id, issue_title, action, issue_type, timestamp, user_display_name FROM activity_log WHERE project_path = ?1 ORDER BY timestamp DESC LIMIT ?2",
        )?;
        let entries = stmt.query_map(rusqlite::params![project_path, limit], |row| {
            Ok(crate::models::ActivityEntry {
                issue_id: row.get(0)?,
                issue_title: row.get(1)?,
                action: row.get(2)?,
                issue_type: row.get(3)?,
                timestamp: row.get(4)?,
                user_display_name: row.get(5)?,
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
                "selected_color_theme" => prefs.selected_color_theme = Some(value),
                "show_resolved_issues" => prefs.show_resolved_issues = Some(value),
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
        if let Some(ref v) = prefs.selected_color_theme {
            conn.execute(
                "INSERT OR REPLACE INTO preferences (key, value) VALUES ('selected_color_theme', ?1)",
                rusqlite::params![v],
            )?;
        }
        if let Some(ref v) = prefs.show_resolved_issues {
            conn.execute(
                "INSERT OR REPLACE INTO preferences (key, value) VALUES ('show_resolved_issues', ?1)",
                rusqlite::params![v],
            )?;
        }
        Ok(())
    }

    pub fn list_color_themes(&self) -> Result<Vec<ColorTheme>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, is_builtin, accent_palette, surface_palette, created_at, updated_at FROM color_themes ORDER BY is_builtin DESC, name ASC",
        )?;
        let themes = stmt.query_map([], |row| {
            let accent_json: String = row.get(3)?;
            let surface_json: String = row.get(4)?;
            let accent_palette: ColorPalette = serde_json::from_str(&accent_json).unwrap_or_default();
            let surface_palette: ColorPalette = serde_json::from_str(&surface_json).unwrap_or_default();
            Ok(ColorTheme {
                id: row.get(0)?,
                name: row.get(1)?,
                is_builtin: row.get::<_, i32>(2)? != 0,
                accent_palette,
                surface_palette,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;
        let mut result = Vec::new();
        for t in themes {
            result.push(t?);
        }
        Ok(result)
    }

    pub fn get_color_theme(&self, id: &str) -> Result<ColorTheme> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let theme = conn.query_row(
            "SELECT id, name, is_builtin, accent_palette, surface_palette, created_at, updated_at FROM color_themes WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                let accent_json: String = row.get(3)?;
                let surface_json: String = row.get(4)?;
                let accent_palette: ColorPalette = serde_json::from_str(&accent_json).unwrap_or_default();
                let surface_palette: ColorPalette = serde_json::from_str(&surface_json).unwrap_or_default();
                Ok(ColorTheme {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    is_builtin: row.get::<_, i32>(2)? != 0,
                    accent_palette,
                    surface_palette,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )?;
        Ok(theme)
    }

    pub fn create_color_theme(&self, theme: &ColorTheme) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let accent_json = serde_json::to_string(&theme.accent_palette)?;
        let surface_json = serde_json::to_string(&theme.surface_palette)?;
        conn.execute(
            "INSERT INTO color_themes (id, name, is_builtin, accent_palette, surface_palette) VALUES (?1, ?2, 0, ?3, ?4)",
            rusqlite::params![theme.id, theme.name, accent_json, surface_json],
        )?;
        Ok(())
    }

    pub fn update_color_theme(&self, theme: &ColorTheme) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let accent_json = serde_json::to_string(&theme.accent_palette)?;
        let surface_json = serde_json::to_string(&theme.surface_palette)?;
        let rows = conn.execute(
            "UPDATE color_themes SET name = ?1, accent_palette = ?2, surface_palette = ?3, updated_at = datetime('now') WHERE id = ?4 AND is_builtin = 0",
            rusqlite::params![theme.name, accent_json, surface_json, theme.id],
        )?;
        if rows == 0 {
            return Err(anyhow::anyhow!("Theme not found or is a built-in theme"));
        }
        Ok(())
    }

    pub fn delete_color_theme(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let rows = conn.execute(
            "DELETE FROM color_themes WHERE id = ?1 AND is_builtin = 0",
            rusqlite::params![id],
        )?;
        if rows == 0 {
            return Err(anyhow::anyhow!("Theme not found or is a built-in theme"));
        }
        Ok(())
    }

    pub fn save_auth_token(
        &self,
        provider: &str,
        access_token: &str,
        refresh_token: Option<&str>,
        token_expiry: Option<&str>,
        display_name: &str,
        username: &str,
        avatar_url: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO auth_tokens (provider, access_token, refresh_token, token_expiry, user_display_name, user_username, user_avatar_url, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'))",
            rusqlite::params![provider, access_token, refresh_token, token_expiry, display_name, username, avatar_url],
        )?;
        Ok(())
    }

    pub fn get_auth_token(&self, provider: &str) -> Result<Option<UserInfo>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let result = conn.query_row(
            "SELECT user_display_name, user_username, user_avatar_url FROM auth_tokens WHERE provider = ?1",
            rusqlite::params![provider],
            |row| {
                Ok(UserInfo {
                    display_name: row.get(0)?,
                    username: row.get(1)?,
                    provider: provider.to_string(),
                    avatar_url: row.get(2)?,
                })
            },
        );
        match result {
            Ok(info) => Ok(Some(info)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn get_auth_access_token(&self, provider: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let result = conn.query_row(
            "SELECT access_token FROM auth_tokens WHERE provider = ?1",
            rusqlite::params![provider],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(token) => Ok(Some(token)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn remove_auth_token(&self, provider: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute(
            "DELETE FROM auth_tokens WHERE provider = ?1",
            rusqlite::params![provider],
        )?;
        Ok(())
    }

    pub fn get_any_auth_user(&self) -> Result<Option<UserInfo>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let result = conn.query_row(
            "SELECT provider, user_display_name, user_username, user_avatar_url FROM auth_tokens ORDER BY updated_at DESC LIMIT 1",
            [],
            |row| {
                Ok(UserInfo {
                    provider: row.get(0)?,
                    display_name: row.get(1)?,
                    username: row.get(2)?,
                    avatar_url: row.get(3)?,
                })
            },
        );
        match result {
            Ok(info) => Ok(Some(info)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
}
