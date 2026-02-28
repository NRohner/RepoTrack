use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type ColorPalette = HashMap<String, String>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub display_name: String,
    pub username: String,
    pub provider: String, // "github", "google", "anon"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}

impl Default for UserInfo {
    fn default() -> Self {
        Self {
            display_name: "anon".to_string(),
            username: "anon".to_string(),
            provider: "anon".to_string(),
            avatar_url: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
    pub user: UserInfo,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorTheme {
    pub id: String,
    pub name: String,
    pub is_builtin: bool,
    pub accent_palette: ColorPalette,
    pub surface_palette: ColorPalette,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IssueType {
    Bug,
    Feature,
    Improvement,
    Task,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    pub id: String,
    pub text: String,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<UserInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(rename = "type")]
    pub issue_type: IssueType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<Severity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<Severity>,
    pub status: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps_to_reproduce: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_behavior: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_behavior: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_case: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub acceptance_criteria: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub votes: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roadmap_quarter: Option<String>,
    #[serde(default)]
    pub comments: Vec<Comment>,
    #[serde(default)]
    pub linked_files: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_estimate_hours: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_spent_hours: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by: Option<UserInfo>,
    #[serde(default)]
    pub history: Vec<HistoryEntry>,
}

pub const REPOTRACK_NOTICE: &str = "This file is managed by RepoTrack. Download it at https://github.com/NRohner/RepoTrack";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoTrackFile {
    #[serde(default = "default_notice")]
    pub _repotrack: String,
    pub version: String,
    pub project_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub issues: Vec<Issue>,
}

fn default_notice() -> String {
    REPOTRACK_NOTICE.to_string()
}

impl RepoTrackFile {
    pub fn new(project_name: String) -> Self {
        let now = Utc::now();
        Self {
            _repotrack: REPOTRACK_NOTICE.to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            project_name,
            created_at: now,
            updated_at: now,
            issues: Vec::new(),
        }
    }

    pub fn next_id(&self, issue_type: &IssueType) -> String {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub last_opened: String,
    pub open_issues: i32,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIssueRequest {
    pub title: String,
    pub description: String,
    pub issue_type: IssueType,
    pub severity: Option<Severity>,
    pub priority: Option<Severity>,
    pub tags: Vec<String>,
    pub steps_to_reproduce: Option<String>,
    pub expected_behavior: Option<String>,
    pub actual_behavior: Option<String>,
    pub environment: Option<String>,
    pub use_case: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub roadmap_quarter: Option<String>,
    pub linked_files: Vec<String>,
    pub time_estimate_hours: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateIssueRequest {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub severity: Option<Severity>,
    pub priority: Option<Severity>,
    pub status: Option<String>,
    pub tags: Option<Vec<String>>,
    pub steps_to_reproduce: Option<String>,
    pub expected_behavior: Option<String>,
    pub actual_behavior: Option<String>,
    pub environment: Option<String>,
    pub use_case: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub roadmap_quarter: Option<String>,
    pub linked_files: Option<Vec<String>>,
    pub time_estimate_hours: Option<f64>,
    pub time_spent_hours: Option<f64>,
    pub votes: Option<i32>,
    pub resolved_at: Option<Option<DateTime<Utc>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkUpdateRequest {
    pub ids: Vec<String>,
    pub status: Option<String>,
    pub severity: Option<Severity>,
    pub priority: Option<Severity>,
    pub tags_add: Option<Vec<String>>,
    pub tags_remove: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectStats {
    pub total_issues: usize,
    pub open_bugs: usize,
    pub open_features: usize,
    pub resolved_this_week: usize,
    pub avg_resolution_days: f64,
    pub most_voted_feature: Option<String>,
    pub most_voted_feature_votes: i32,
    pub bugs_by_severity: SeverityCounts,
    pub features_by_priority: SeverityCounts,
    pub bugs_by_status: Vec<StatusCount>,
    pub features_by_status: Vec<StatusCount>,
    pub all_by_status: Vec<StatusCount>,
    pub issues_over_time: Vec<TimeSeriesPoint>,
    pub open_bugs_over_time: Vec<TimeSeriesPoint>,
    pub open_features_over_time: Vec<TimeSeriesPoint>,
    pub resolution_time_buckets: Vec<BucketCount>,
    pub creation_heatmap: Vec<HeatmapDay>,
    pub tag_breakdown: Vec<TagInfo>,
    pub activity_feed: Vec<ActivityEntry>,
    pub top_oldest_bugs: Vec<OldestIssue>,
    pub top_voted_features: Vec<VotedFeature>,
    pub bug_velocity: Vec<TimeSeriesPoint>,
    pub feature_funnel: Vec<FunnelStep>,
    pub features_by_quarter: Vec<QuarterGroup>,
    pub features_by_tag: Vec<TagCount>,
    pub critical_high_bugs: usize,
    pub planned_features: usize,
    pub completed_features_this_month: usize,
    pub total_votes: i32,
    pub oldest_open_bug: Option<OldestIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeverityCounts {
    pub critical: usize,
    pub high: usize,
    pub medium: usize,
    pub low: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusCount {
    pub status: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSeriesPoint {
    pub date: String,
    pub value: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BucketCount {
    pub bucket: String,
    pub bugs: usize,
    pub features: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapDay {
    pub date: String,
    pub count: usize,
    pub bugs: usize,
    pub features: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo {
    pub tag: String,
    pub count: usize,
    pub open_bugs: usize,
    pub features: usize,
    pub resolved: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEntry {
    pub timestamp: String,
    pub issue_id: String,
    pub issue_title: String,
    pub action: String,
    pub issue_type: String,
    #[serde(default = "default_anon")]
    pub user_display_name: String,
}

fn default_anon() -> String {
    "anon".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OldestIssue {
    pub id: String,
    pub title: String,
    pub severity: String,
    pub created_at: String,
    pub age_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotedFeature {
    pub id: String,
    pub title: String,
    pub votes: i32,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunnelStep {
    pub stage: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarterGroup {
    pub quarter: String,
    pub features: Vec<QuarterFeature>,
    pub total_votes: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarterFeature {
    pub id: String,
    pub title: String,
    pub priority: String,
    pub status: String,
    pub votes: i32,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagCount {
    pub tag: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    pub theme: String,
    pub default_view: String,
    pub default_layout: String,
    pub default_status_filter: Option<String>,
    pub default_severity_filter: Option<String>,
    pub selected_color_theme: Option<String>,
    pub show_resolved_issues: Option<String>,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            default_view: "all".to_string(),
            default_layout: "table".to_string(),
            default_status_filter: None,
            default_severity_filter: None,
            selected_color_theme: None,
            show_resolved_issues: None,
        }
    }
}
