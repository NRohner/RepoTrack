export type IssueType = "bug" | "feature" | "improvement" | "task";

export type Severity = "critical" | "high" | "medium" | "low";

export const STATUSES = ["open", "in-progress", "completed", "wont-fix"] as const;
export type IssueStatus = (typeof STATUSES)[number];

export interface UserInfo {
  display_name: string;
  username: string;
  provider: string; // "github" | "google" | "anon"
  avatar_url?: string;
}

export interface HistoryEntry {
  action: string;
  from?: string;
  to?: string;
  user: UserInfo;
  timestamp: string;
}

export interface Comment {
  id: string;
  text: string;
  created_at: string;
  created_by?: UserInfo;
}

export interface Attachment {
  id: string;
  filename: string;
  size_bytes: number;
  created_at: string;
  created_by?: UserInfo;
}

export interface Issue {
  id: string;
  uuid: string;
  title: string;
  description: string;
  type: IssueType;
  severity?: Severity;
  priority?: Severity;
  status: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  environment?: string;
  use_case?: string;
  acceptance_criteria?: string;
  votes?: number;
  roadmap_quarter?: string;
  comments: Comment[];
  attachments: Attachment[];
  linked_files: string[];
  time_estimate_hours?: number;
  time_spent_hours?: number;
  created_by?: UserInfo;
  history: HistoryEntry[];
}

export interface RepoTrackFile {
  version: string;
  project_name: string;
  created_at: string;
  updated_at: string;
  issues: Issue[];
  storage_format?: "legacy" | "directory";
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_opened: string;
  open_issues: number;
  exists: boolean;
}

export interface CreateIssueRequest {
  title: string;
  description: string;
  issue_type: IssueType;
  severity?: Severity;
  priority?: Severity;
  tags: string[];
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  environment?: string;
  use_case?: string;
  acceptance_criteria?: string;
  roadmap_quarter?: string;
  linked_files: string[];
  time_estimate_hours?: number;
}

export interface UpdateIssueRequest {
  id: string;
  title?: string;
  description?: string;
  severity?: Severity;
  priority?: Severity;
  status?: string;
  tags?: string[];
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  environment?: string;
  use_case?: string;
  acceptance_criteria?: string;
  roadmap_quarter?: string;
  linked_files?: string[];
  time_estimate_hours?: number;
  time_spent_hours?: number;
  votes?: number;
  resolved_at?: string | null;
}

export interface BulkUpdateRequest {
  ids: string[];
  status?: string;
  severity?: Severity;
  priority?: Severity;
  tags_add?: string[];
  tags_remove?: string[];
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface BucketCount {
  bucket: string;
  bugs: number;
  features: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
  bugs: number;
  features: number;
}

export interface TagInfo {
  tag: string;
  count: number;
  open_bugs: number;
  features: number;
  resolved: number;
}

export interface ActivityEntry {
  timestamp: string;
  issue_id: string;
  issue_title: string;
  action: string;
  issue_type: string;
  user_display_name: string;
}

export interface OldestIssue {
  id: string;
  title: string;
  severity: string;
  created_at: string;
  age_days: number;
}

export interface VotedFeature {
  id: string;
  title: string;
  votes: number;
  status: string;
}

export interface FunnelStep {
  stage: string;
  count: number;
}

export interface QuarterFeature {
  id: string;
  title: string;
  priority: string;
  status: string;
  votes: number;
  tags: string[];
}

export interface QuarterGroup {
  quarter: string;
  features: QuarterFeature[];
  total_votes: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface ProjectStats {
  total_issues: number;
  open_bugs: number;
  open_features: number;
  resolved_this_week: number;
  avg_resolution_days: number;
  most_voted_feature: string | null;
  most_voted_feature_votes: number;
  bugs_by_severity: SeverityCounts;
  features_by_priority: SeverityCounts;
  bugs_by_status: StatusCount[];
  features_by_status: StatusCount[];
  all_by_status: StatusCount[];
  issues_over_time: TimeSeriesPoint[];
  open_bugs_over_time: TimeSeriesPoint[];
  open_features_over_time: TimeSeriesPoint[];
  resolution_time_buckets: BucketCount[];
  creation_heatmap: HeatmapDay[];
  tag_breakdown: TagInfo[];
  activity_feed: ActivityEntry[];
  top_oldest_bugs: OldestIssue[];
  top_voted_features: VotedFeature[];
  bug_velocity: TimeSeriesPoint[];
  feature_funnel: FunnelStep[];
  features_by_quarter: QuarterGroup[];
  features_by_tag: TagCount[];
  critical_high_bugs: number;
  planned_features: number;
  completed_features_this_month: number;
  total_votes: number;
  oldest_open_bug: OldestIssue | null;
}

export interface UserPreferences {
  theme: string;
  default_view: string;
  default_layout: string;
  default_status_filter?: string;
  default_severity_filter?: string;
  selected_color_theme?: string;
  show_resolved_issues?: string;
  default_editor?: string;
}

export type ColorPalette = Record<string, string>;

export interface ColorTheme {
  id: string;
  name: string;
  is_builtin: boolean;
  accent_palette: ColorPalette;
  surface_palette: ColorPalette;
  created_at: string;
  updated_at: string;
}

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface GitStatus {
  is_git_repo: boolean;
  current_branch: string;
  repotrack_has_changes: boolean;
  changed_files: string[];
  unpushed_hashes: string[];
}

export interface GitBranch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  last_commit_summary: string;
}

export interface GitCommitInfo {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  timestamp: number;
  parent_hashes: string[];
  refs: string[];
  is_merge: boolean;
}

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500",
  "in-progress": "bg-yellow-500",
  completed: "bg-green-500",
  "wont-fix": "bg-gray-400",
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-slate-400 text-white",
};

// TYPE_ICONS moved to shared/components/TypeIcon.tsx as React components
