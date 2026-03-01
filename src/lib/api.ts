import { invoke } from "@tauri-apps/api/core";
import type {
  Issue,
  RepoTrackFile,
  ProjectInfo,
  CreateIssueRequest,
  UpdateIssueRequest,
  BulkUpdateRequest,
  Comment,
  Attachment,
  ProjectStats,
  UserPreferences,
  DirEntry,
  ColorTheme,
  UserInfo,
} from "./types";

export async function listRecentProjects(): Promise<ProjectInfo[]> {
  return invoke("list_recent_projects");
}

export async function openProject(path: string): Promise<RepoTrackFile> {
  return invoke("open_project", { path });
}

export async function createProject(
  path: string,
  name: string
): Promise<RepoTrackFile> {
  return invoke("create_project", { path, name });
}

export async function removeProject(path: string): Promise<void> {
  return invoke("remove_project", { path });
}

export async function getIssues(): Promise<Issue[]> {
  return invoke("get_issues");
}

export async function createIssue(
  request: CreateIssueRequest
): Promise<Issue> {
  return invoke("create_issue", { request });
}

export async function updateIssue(
  request: UpdateIssueRequest
): Promise<Issue> {
  return invoke("update_issue", { request });
}

export async function deleteIssue(id: string): Promise<void> {
  return invoke("delete_issue", { id });
}

export async function bulkUpdateIssues(
  request: BulkUpdateRequest
): Promise<Issue[]> {
  return invoke("bulk_update_issues", { request });
}

export async function addComment(
  issueId: string,
  text: string
): Promise<Comment> {
  return invoke("add_comment", { issueId, text });
}

export async function voteIssue(issueId: string): Promise<number> {
  return invoke("vote_issue", { issueId });
}

export async function getProjectStats(): Promise<ProjectStats> {
  return invoke("get_project_stats");
}

export async function getPreferences(): Promise<UserPreferences> {
  return invoke("get_preferences");
}

export async function updatePreferences(
  prefs: UserPreferences
): Promise<void> {
  return invoke("update_preferences", { prefs });
}

export async function updateProjectName(name: string): Promise<void> {
  return invoke("update_project_name", { name });
}

export async function getActiveProjectPath(): Promise<string> {
  return invoke("get_active_project_path");
}

export async function getActiveProject(): Promise<RepoTrackFile | null> {
  return invoke("get_active_project");
}

export async function closeProject(): Promise<void> {
  return invoke("close_project");
}

export async function listDirectoryContents(
  dir: string
): Promise<DirEntry[]> {
  return invoke("list_directory_contents", { dir });
}

export async function exportCsv(path: string): Promise<void> {
  return invoke("export_csv", { path });
}

export async function exportMarkdown(path: string): Promise<void> {
  return invoke("export_markdown", { path });
}

export async function reloadProject(): Promise<RepoTrackFile> {
  return invoke("reload_project");
}

export async function deleteAllIssues(
  issueType?: string
): Promise<void> {
  return invoke("delete_all_issues", { issueType: issueType ?? null });
}

export async function updateRecentMenu(): Promise<void> {
  return invoke("update_recent_menu");
}

export async function migrateProject(): Promise<RepoTrackFile> {
  return invoke("migrate_project");
}

export async function listColorThemes(): Promise<ColorTheme[]> {
  return invoke("list_color_themes");
}

export async function getColorTheme(id: string): Promise<ColorTheme> {
  return invoke("get_color_theme", { id });
}

export async function createColorTheme(theme: ColorTheme): Promise<void> {
  return invoke("create_color_theme", { theme });
}

export async function updateColorTheme(theme: ColorTheme): Promise<void> {
  return invoke("update_color_theme", { theme });
}

export async function deleteColorTheme(id: string): Promise<void> {
  return invoke("delete_color_theme", { id });
}

// Attachments
export async function addAttachment(
  issueId: string,
  sourcePath: string
): Promise<Attachment> {
  return invoke("add_attachment", { issueId, sourcePath });
}

export async function removeAttachment(
  issueId: string,
  attachmentId: string
): Promise<void> {
  return invoke("remove_attachment", { issueId, attachmentId });
}

export async function getAttachmentData(
  issueId: string,
  attachmentId: string
): Promise<string> {
  return invoke("get_attachment_data", { issueId, attachmentId });
}

export async function openAttachment(
  issueId: string,
  attachmentId: string
): Promise<void> {
  return invoke("open_attachment", { issueId, attachmentId });
}

// Auth
export async function signIn(provider: string): Promise<UserInfo> {
  return invoke("sign_in", { provider });
}

export async function signOut(provider: string): Promise<void> {
  return invoke("sign_out", { provider });
}

export async function getCurrentUser(): Promise<UserInfo | null> {
  return invoke("get_current_user");
}
