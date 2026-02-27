# Project: RepoTrack — File-Backed Issue & Feature Tracker Desktop App

## Overview
Build a cross-platform desktop application using Tauri (Rust backend + React frontend) for lightweight issue and feature request tracking that lives inside project repositories. Instead of storing data in a centralized database, each project's issues and feature requests are written to a `repotrack.json` file at the root of the project repo. The user never edits this file directly — all interaction happens through a polished, modern GUI. A small SQLite database in the app's data directory stores metadata such as known project paths, user preferences, and recent activity, providing persistent memory across sessions so the user can quickly reopen projects without browsing to them each time.

The tool tracks two primary workstreams: **Bugs** (defects, regressions, unexpected behavior) and **Feature Requests** (new capabilities, enhancements, user-facing improvements). Both are stored as "issues" with a `type` field, but the UI provides dedicated views, workflows, and dashboard analytics for each.

As a Tauri app, RepoTrack has direct access to the user's filesystem with no configuration needed — the user simply opens any project directory using a native file dialog.

---

## Architecture

### Tauri Desktop App (Rust + React)
- **Framework:** Tauri v2. The Rust backend handles all filesystem operations, data persistence, and business logic. The React frontend runs in a webview and communicates with the Rust backend via Tauri's IPC command system (`#[tauri::command]`).
- **Why Tauri:** Native filesystem access with no configuration, native file/folder dialogs, native menu bar, small binary size, cross-platform (macOS, Windows, Linux).

### Backend (Rust, via Tauri)
- **Tauri Commands:** All data operations are exposed as Tauri commands invoked from the frontend. The frontend never accesses the filesystem directly — all reads and writes go through Rust. Commands include:
  - Project management: `open_project`, `create_project`, `list_recent_projects`, `remove_project`, `browse_directory` (opens native folder picker dialog).
  - Issue CRUD: `create_issue`, `update_issue`, `delete_issue`, `get_issues`, `bulk_update_issues`.
  - Stats: `get_project_stats` (returns all aggregated data needed for the dashboard).
  - Preferences: `get_preferences`, `update_preferences`.
  - Export/Import: `export_csv`, `export_markdown`, `import_csv`.
  - File browsing: `list_directory_contents` (for the linked files picker — lists files within the project directory).
- **Internal Database (SQLite via `rusqlite` or `sqlx`):** Stored in the Tauri app data directory (`tauri::api::path::app_data_dir`). Stores:
  - **Projects Registry:** Absolute path to each known project's `repotrack.json`, project display name, date added, last opened timestamp.
  - **User Preferences:** Theme (dark/light/system), default sort order, default filters, dashboard layout preferences, saved issue templates.
  - **Activity Log:** A lightweight event log (issue created, resolved, reopened, deleted, commented) used to power the dashboard activity feed and burndown charts. This is a denormalized copy — the `repotrack.json` is always the source of truth for issue data.
  - This database is NOT the source of truth for issues. If the `repotrack.json` file is modified externally (e.g., by a teammate committing changes), the backend detects this and reconciles.
- **File Storage Layer:** A Rust module that manages reading/writing `repotrack.json` files:
  - On project open, reads the file into memory (held in Tauri managed state).
  - On every mutation, writes back to disk with pretty-printed JSON (2-space indent, sorted keys within each issue for stable git diffs).
  - Uses a `tokio::sync::Mutex` on the in-memory state to prevent concurrent write corruption from rapid UI interactions.
  - Watches the file with `notify` (Rust file watcher crate) for external changes (e.g., after `git pull`). On external change, reloads from disk and emits a Tauri event to the frontend so it can refresh.
- **Tauri Events:** The Rust backend emits events to the frontend for:
  - `file-changed` — the `repotrack.json` was modified externally.
  - `project-updated` — an issue was created/updated/deleted (used to keep multiple windows in sync if the user opens the same project twice).

### Frontend (React + TypeScript + Vite)
- **Framework:** React 18+ with TypeScript, built with Vite. Integrated into the Tauri build pipeline via `tauri.conf.json`.
- **Styling:** Tailwind CSS for utility styling. All custom components built from scratch — no component library like MUI or Chakra. The UI should feel custom-designed, not like a template.
- **Charts:** Use Recharts for all data visualizations.
- **State Management:** Zustand for global state (active project, theme, cached issue data). React Query (`@tanstack/react-query`) adapted for Tauri commands (wrap `invoke()` calls as query functions for caching, deduplication, and background refresh).
- **Routing:** React Router v6 for client-side routing within the webview.
- **Theme Detection:** Use Tauri's `window.theme()` API to detect the OS theme for the "System" theme option, and listen for theme change events to update in real time.
- **IPC Layer:** A `src/lib/api.ts` module that wraps all `invoke()` calls with TypeScript types, providing a clean typed API surface for the rest of the frontend. Example:
  ```typescript
  export async function getIssues(projectId: string): Promise<Issue[]> {
    return invoke('get_issues', { projectId });
  }
  ```

---

## `repotrack.json` Schema

This file lives at the root of each project repo. It must be designed for clean git diffs: pretty-printed, deterministic key ordering, and no unnecessary churn on writes. The schema:

```json
{
  "version": "1.0",
  "project_name": "My App",
  "created_at": "2026-02-20T10:00:00Z",
  "updated_at": "2026-02-27T14:30:00Z",
  "issues": [
    {
      "id": "BUG-0001",
      "title": "Login button unresponsive on mobile",
      "description": "Tapping the login button on iOS Safari requires two taps...",
      "type": "bug",
      "severity": "high",
      "status": "open",
      "tags": ["frontend", "mobile", "auth"],
      "created_at": "2026-02-21T09:15:00Z",
      "updated_at": "2026-02-25T11:00:00Z",
      "resolved_at": null,
      "steps_to_reproduce": "1. Open app on iOS Safari\n2. Tap login button\n3. Nothing happens on first tap",
      "expected_behavior": "Login modal should open on first tap.",
      "actual_behavior": "Requires two taps to register.",
      "environment": "iOS 17.3, Safari, iPhone 14 Pro",
      "comments": [
        {
          "id": "CMT-0001",
          "text": "Reproduced on iPhone 14 Pro, iOS 17.3.",
          "created_at": "2026-02-22T08:00:00Z"
        }
      ],
      "linked_files": ["src/components/LoginButton.tsx"],
      "time_estimate_hours": 2.0,
      "time_spent_hours": 0.5
    },
    {
      "id": "FEAT-0001",
      "title": "Add dark mode support",
      "description": "Users have requested a dark theme for the application...",
      "type": "feature",
      "priority": "high",
      "status": "planned",
      "tags": ["ui", "accessibility", "theme"],
      "created_at": "2026-02-22T10:00:00Z",
      "updated_at": "2026-02-26T16:00:00Z",
      "resolved_at": null,
      "use_case": "Users working in low-light environments experience eye strain with the current all-white UI.",
      "acceptance_criteria": "- All pages render correctly in dark mode\n- User preference is persisted\n- System preference is respected by default",
      "votes": 12,
      "roadmap_quarter": "Q2 2026",
      "comments": [],
      "linked_files": [],
      "time_estimate_hours": 16.0,
      "time_spent_hours": 0
    }
  ]
}
```

### Shared Fields (All Issue Types)
- `id`: Auto-generated sequential ID with a type-specific prefix: `BUG-0001` for bugs, `FEAT-0001` for feature requests, `IMP-0001` for improvements, `TASK-0001` for tasks. Never reused.
- `title`: Short summary (required, max 200 characters).
- `description`: Detailed description in Markdown format. Rendered in the UI.
- `type`: One of `bug`, `feature`, `improvement`, `task`.
- `status`: Depends on type (see below).
- `tags`: Array of freeform string tags for categorization.
- `comments`: Threaded comments, each with an ID, text (Markdown), and timestamp.
- `linked_files`: Array of relative file paths within the project that are relevant to this issue.
- `time_estimate_hours` and `time_spent_hours`: Optional time tracking fields.

### Bug-Specific Fields
- `severity`: One of `critical`, `high`, `medium`, `low`. (Bugs use "severity" to indicate impact.)
- `status`: One of `open`, `in-progress`, `resolved`, `closed`, `wont-fix`.
- `steps_to_reproduce`: Optional Markdown string describing how to reproduce the bug.
- `expected_behavior`: Optional string.
- `actual_behavior`: Optional string.
- `environment`: Optional freeform string (e.g., "Chrome 122, macOS 14.3, Node 20.11").

### Feature Request-Specific Fields
- `priority`: One of `critical`, `high`, `medium`, `low`. (Features use "priority" to indicate importance/demand.)
- `status`: One of `proposed`, `under-review`, `planned`, `in-progress`, `completed`, `declined`.
- `use_case`: Optional Markdown string describing the user problem or motivation.
- `acceptance_criteria`: Optional Markdown string defining what "done" looks like (rendered as a checklist if formatted with `- [ ]` syntax).
- `votes`: Integer upvote count (default `0`). Users can upvote feature requests in the UI to signal demand. This helps prioritize the backlog.
- `roadmap_quarter`: Optional string (e.g., `"Q2 2026"`, `"Backlog"`, `null`). Used to place features on the roadmap view.

---

## Frontend — Pages & Features

### 1. Home / Project Selector
The landing page when no project is active.
- **Recent Projects:** A list/grid of recently opened projects, sorted by last opened. Each card shows: project name, path, total open issues count, and a colored badge for the highest-priority open issue. Clicking opens the project.
- **Add Project:**
  - **Browse:** A button that opens the **native OS folder picker dialog** (via Tauri's `dialog::FileDialogBuilder`). The user selects a project directory. If a `repotrack.json` exists in it, the project is loaded. If not, a modal prompts the user to initialize one (enter a project name, and a fresh `repotrack.json` is created in that directory).
  - **Drag & Drop:** The user can drag a folder from Finder/Explorer onto the app window to add it as a project (Tauri supports drop events).
- **Remove Project:** Remove a project from the registry (does NOT delete the `repotrack.json` file — just de-registers it from the app). If the project directory no longer exists (e.g., it was moved or deleted), show a "missing" badge on the project card with an option to re-locate or remove it.

### 2. Issue Board (Main View)
The primary working view after selecting a project. A tab bar across the top provides filtered views: **All**, **Bugs**, **Features**, **Improvements**, **Tasks**. The active tab filters the list to that type. The "All" tab shows everything. Each tab displays a count badge (e.g., "Bugs (14)"). Two layout modes are available within any tab, toggleable:

#### Table View (Default)
- A dense, sortable, filterable table of all issues (filtered by active tab).
- **Columns:** ID, Title (truncated), Type (icon — 🐛 bug, ✨ feature, 🔧 improvement, 📋 task), Severity/Priority (colored badge — the column header reads "Severity" when the Bugs tab is active, "Priority" when the Features tab is active, and "Severity/Priority" on the All tab), Status (colored pill — the available values change based on type), Tags, Votes (shown only when Features tab is active or on All tab; displays the upvote count with a small arrow icon), Created date, Updated date.
- **Sorting:** Click any column header to sort ascending/descending.
- **Filtering:**
  - A persistent filter bar at the top with dropdowns for: Status (options change dynamically based on active type tab), Severity/Priority, and a Tag multi-select.
  - A search box that filters by title and description text (client-side, since all issues are loaded).
  - Active filters are shown as dismissible chips.
  - Filter state is preserved in the URL query string so it's shareable and survives refresh.
- **Bulk Actions:** Checkbox selection. Bulk update status, severity/priority, or tags. Bulk delete (with confirmation modal).
- **Inline Quick Edit:** Clicking a status pill or severity/priority badge opens an inline dropdown to change it without opening the full issue detail.

#### Kanban View
- Columns represent statuses. The columns adapt to the active type tab:
  - **Bugs tab:** Open → In Progress → Resolved → Closed (collapsed "Won't Fix" column).
  - **Features tab:** Proposed → Under Review → Planned → In Progress → Completed (collapsed "Declined" column).
  - **All tab:** Combines both sets of statuses into a unified board grouped by workflow stage (e.g., "New" = Open + Proposed, "Active" = In Progress, "Done" = Resolved + Completed, etc.).
- Issues are cards showing: title, type icon, severity/priority stripe (color bar on the left), tags, vote count (for features), and time since creation.
- Drag-and-drop cards between columns to change status (use `@dnd-kit/core`). Only valid status transitions for the issue's type are allowed — dropping a bug card onto a "Planned" column should snap it back.
- Cards are sorted within columns by severity/priority (critical on top), then by votes (for features), then by creation date.

### 3. Issue Detail View
Opened by clicking an issue from the board. Rendered as a slide-over panel (not a separate page) so the user retains context of the board behind it.
- **Header:** ID (with type-colored prefix badge), title (editable inline), status dropdown (options adapt to the issue type), severity dropdown (for bugs) or priority dropdown (for features).
- **Body:**
  - Description rendered as Markdown (use `react-markdown` with syntax highlighting via `react-syntax-highlighter` for code blocks).
  - Edit button switches to a Markdown editor with a live preview pane.
  - **Bug-specific sections** (shown only when type is `bug`): "Steps to Reproduce", "Expected Behavior", "Actual Behavior", "Environment" — each rendered as a labeled, collapsible section. Editable inline.
  - **Feature-specific sections** (shown only when type is `feature`): "Use Case", "Acceptance Criteria" (rendered as a checklist if the Markdown uses `- [ ]` syntax; checkboxes are interactive and update the JSON when toggled), "Roadmap Quarter" (dropdown: Backlog, Q1–Q4 for the current and next year).
  - **Vote button** (features only): A prominent upvote button with the current count, displayed near the title. Clicking increments the vote count. The button has a satisfying micro-animation (number ticks up, brief pulse).
- **Sidebar Metadata:** Type (read-only after creation), Tags (with an "add tag" input that autocompletes from existing tags across all issue types), Linked Files, Time Estimate, Time Spent.
- **Comments Section:** Chronological list of comments, each with rendered Markdown. A text area at the bottom to add a new comment.
- **Activity Timeline:** Below comments, a compact timeline showing all status changes, severity/priority changes, vote milestones, and edits with timestamps (e.g., "Status changed from Proposed → Planned — Feb 25, 2:30 PM").
- **Delete Issue:** Button at the bottom with a confirmation dialog. Deleted issues are hard-deleted from the JSON (they're in git history if the user needs recovery).

### 4. New Issue Form
Accessed via a prominent "New Issue" button visible on all project pages. The button is actually a split button: the main action opens the form with the type matching the active tab (e.g., if on the Bugs tab, it defaults to "Bug"), and a dropdown arrow lets the user explicitly choose the type.

- **Type Selector (top of form):** A toggle or segmented control for Bug / Feature / Improvement / Task. Selecting a type dynamically shows/hides the type-specific fields below, with a smooth transition.
- **Shared Fields:** Title (required), Description (Markdown editor with preview), Tags (multi-select with autocomplete from existing tags + ability to create new), Linked Files (text inputs for relative paths, with a file browser button that navigates the project directory), Time Estimate (optional number input).
- **Bug-Specific Fields (visible when type = bug):** Severity (dropdown, default: medium), Steps to Reproduce (Markdown textarea), Expected Behavior (text), Actual Behavior (text), Environment (freeform text with a "paste from clipboard" button for convenience).
- **Feature-Specific Fields (visible when type = feature):** Priority (dropdown, default: medium), Use Case (Markdown textarea, with placeholder text: "Describe the problem this feature would solve..."), Acceptance Criteria (Markdown textarea, with placeholder text: "- [ ] Criterion one\n- [ ] Criterion two"), Roadmap Quarter (dropdown: Backlog, Q1–Q4 for current and next year, default: Backlog).
- **Quick Submit:** Keyboard shortcut `Ctrl+Enter` / `Cmd+Enter` submits the form.
- **Template Support:** The user can save the current form as a named template (stored in preferences, scoped by type). When creating a new issue, a "Use Template" dropdown lets them pre-fill from a saved template. Include two built-in default templates:
  - **"Bug Report"** (type: bug): Pre-fills the description with sections: "## Summary\n\n## Steps to Reproduce\n\n1. \n2. \n3. \n\n## Expected Behavior\n\n## Actual Behavior\n\n## Environment\n\n"
  - **"Feature Request"** (type: feature): Pre-fills the description with sections: "## Problem Statement\n\nDescribe the user problem...\n\n## Proposed Solution\n\n## Alternatives Considered\n\n"

### 5. Dashboard
A dedicated analytics view for the active project. This should be visually impressive — the kind of dashboard that makes people say "whoa." Dark mode is particularly important here. A tab bar at the top switches between **Overview**, **Bugs**, and **Features** dashboards.

#### Overview Dashboard

**Key Metrics Strip (Top)**
Six metric cards in a row, each with:
- The metric value in a large, bold font.
- A subtle sparkline (past 30 days) or percentage change indicator.
- Cards: **Total Issues**, **Open Bugs**, **Open Feature Requests**, **Resolved This Week**, **Average Bug Resolution Time**, **Most Requested Feature** (title of the feature with the highest vote count, truncated).

**Charts & Visualizations (use Recharts)**

1. **Dual Burndown Chart** (Area Chart)
   - X-axis: time (days/weeks, auto-scaled based on project age).
   - Two overlaid area series: one for bugs (red/orange tones) and one for feature requests (blue/purple tones), each showing the count of open items over time.
   - Smooth curves, gradient fills, translucent areas. Legend to toggle each series.

2. **Issues by Status** (Donut Chart)
   - Segments for each status, colored to match the status pills used elsewhere in the UI.
   - Center of the donut shows total issue count.
   - Hover reveals count and percentage.
   - A small toggle switches the donut between showing all issues, bugs only, or features only.

3. **Issues by Severity/Priority** (Horizontal Bar Chart)
   - Grouped bars: bugs (by severity) and features (by priority) shown side by side.
   - Bars colored by level (critical = red, high = orange, medium = yellow, low = blue-gray).
   - Show count labels at the end of each bar.

4. **Resolution Time Distribution** (Histogram)
   - X-axis: resolution time buckets (< 1 day, 1–3 days, 3–7 days, 1–2 weeks, 2+ weeks).
   - Y-axis: count of resolved issues in each bucket.
   - Stacked bars separating bugs vs features in different colors.

5. **Issue Creation Heatmap** (Calendar Heatmap, similar to GitHub's contribution graph)
   - Shows the past 12 months (or project lifetime, whichever is shorter).
   - Each cell is a day. Color intensity represents the number of issues created that day.
   - Tooltip on hover shows the date, count, and type breakdown.

6. **Tag Breakdown** (Treemap or Bubble Chart)
   - Each tag is a bubble/rectangle sized by the number of issues with that tag.
   - Color-coded: red-tinted if most issues with that tag are open bugs, blue-tinted if mostly feature requests, green-tinted if mostly resolved.
   - Clicking a tag navigates to the issue board pre-filtered by that tag.

7. **Activity Feed** (Timeline, right sidebar or below charts)
   - A real-time scrolling feed of recent actions: "BUG-0042 marked as resolved", "New feature FEAT-0051 created", "FEAT-0012 received 5 votes".
   - Each entry has a timestamp, a type icon, and a link to the issue.

#### Bugs Dashboard
Shown when the "Bugs" tab is selected. Focuses specifically on bug health:
- **Metrics:** Open Bugs, Critical/High Open, Resolved This Week, Avg Resolution Time, Oldest Open Bug (with link).
- **Bug Burndown** (dedicated area chart, bugs only).
- **Bugs by Severity** (pie chart).
- **Top 10 Oldest Open Bugs** (table with ID, title, severity, age — helps identify stale bugs).
- **Bug Resolution Velocity** (line chart: bugs resolved per week over time, with a trend line).

#### Features Dashboard
Shown when the "Features" tab is selected. Focuses on feature request health and prioritization:
- **Metrics:** Total Feature Requests, Planned Features, Completed This Month, Most Voted Feature, Total Votes Across All Features.
- **Feature Funnel** (funnel chart): Proposed → Under Review → Planned → In Progress → Completed, showing how many features are at each stage and the conversion rate between stages.
- **Top 10 Most Voted Features** (table with ID, title, votes, status — sortable, with a link to each feature). This is the community-driven prioritization view.
- **Feature Roadmap Timeline** (horizontal Gantt-style chart): Features grouped by `roadmap_quarter`. Each quarter is a column, features are horizontal bars within their quarter. Color-coded by status. Features without a quarter appear in a "Backlog" column at the end.
- **Features by Tag** (horizontal bar chart showing which areas of the product have the most feature demand).

### 6. Feature Roadmap View (Dedicated Page)
A standalone page (separate from the dashboard) providing a visual, board-style roadmap for feature requests:
- **Layout:** A horizontal scrolling board with columns for each `roadmap_quarter` value (e.g., "Backlog", "Q1 2026", "Q2 2026", "Q3 2026"). Each column contains feature request cards.
- **Cards:** Each card shows the feature title, priority badge, vote count with upvote button, status pill, and tags.
- **Drag-and-drop:** Drag feature cards between quarter columns to reassign their `roadmap_quarter`. Drag within a column to reorder (ordering is persisted as the card's position in the JSON array for that quarter).
- **Filter bar:** Filter by priority, status, or tag.
- **Collapsed View:** Each column header shows a count and a total vote count for features in that quarter. Columns can be collapsed to show just the header for a high-level overview.
- This view only shows issues of type `feature`. It is accessible from the main navigation.

### 7. Settings Page
- **Theme:** Toggle between Light Mode, Dark Mode, and System (auto-detect via `prefers-color-scheme` and Tauri's `window.theme()` API).
- **Default View:** Choose the default tab when opening a project (All, Bugs, Features) and the default layout (Table or Kanban).
- **Default Filters:** Set the default status/severity/priority filters for the issue board.
- **Roadmap Quarters:** Configure which quarters are visible on the roadmap view (e.g., hide past quarters).
- **Project Settings:** Rename the project (updates `project_name` in `repotrack.json`), view the file path, copy the path to clipboard.
- **Export:** Export all issues as CSV (with type-specific columns included), or as a Markdown file (formatted as a readable issue list with headers and descriptions, with separate sections for Bugs and Features). Export uses a native save dialog to choose the destination.
- **Import:** Import issues from a CSV file (opened via native file picker dialog, with a column mapping step that includes type, severity/priority, and feature-specific fields).
- **Danger Zone:** "Delete All Issues" (clears the JSON but keeps the file), "Delete All Bugs Only", "Delete All Features Only", "Reset Preferences".

---

## UI/UX Design Requirements

### Visual Design
- **Dark Mode First:** Design the dark theme as the primary experience, then ensure light mode is equally polished. Dark mode should use rich, deep backgrounds (not pure black) — think `#0a0a0f` to `#12121a` range with subtle blue or purple undertones.
- **Accent Color:** A vibrant accent color (electric blue, `#6366f1` indigo, or similar) used for primary actions, active states, and chart highlights. This should pop against the dark background.
- **Typography:** Clean sans-serif font. Use `Inter` (loaded via Google Fonts or bundled). Clear hierarchy: large bold headings, medium semi-bold subheadings, regular body text. Generous line height.
- **Spacing & Layout:** Generous whitespace. Content should feel spacious, not cramped. Use a consistent 4px/8px spacing scale.
- **Borders & Depth:** Minimal borders. Use subtle background color shifts and soft shadows (`box-shadow` with low opacity) to create depth. Cards should feel like they float slightly above the background.
- **Animations:** Smooth, subtle transitions everywhere:
  - Page/panel transitions: fade + slight slide (150–250ms ease-out).
  - Status pill changes: color morph transition.
  - Dashboard charts: animated entry on load (Recharts animation props).
  - Hover states: gentle scale or brightness shift.
  - Kanban drag: smooth card movement with a drop shadow on the dragged card.
  - Modal/slide-over: backdrop fade + panel slide from right.
- **Micro-interactions:** Button press effects (slight scale down), success confirmations (brief green flash or checkmark animation), loading skeletons (shimmer effect) for any async content.

### Responsive Layout
- The app should be fully functional when the window is resized down to 900px width. Below that, gracefully degrade (collapse sidebar, stack layout).
- The Kanban view should horizontally scroll in narrow windows.

---

## Non-Functional Requirements

### Tauri Build & Distribution
- **`tauri.conf.json`:** Properly configured with app name ("RepoTrack"), window title, default window size (1280×800, min 900×600), and permissions for filesystem access, dialog, and shell APIs.
- **Build:** `npm run tauri build` produces a distributable application:
  - macOS: `.dmg` installer.
  - Windows: `.msi` installer.
  - Linux: `.AppImage` and `.deb`.
- **Development:** `npm run tauri dev` launches the app in development mode with hot-reload for the React frontend and Rust backend recompilation.
- **App Data:** The SQLite database and any app configuration are stored in the OS-appropriate app data directory (Tauri provides this automatically via `app_data_dir`). This persists across app updates.
- **Single Instance:** Enforce single-instance mode — if the user tries to launch a second instance, focus the existing window instead.

### Code Quality
- TypeScript strict mode for the frontend. Rust code follows idiomatic conventions with proper error handling (`thiserror` for the library, `anyhow` for command handlers).
- Rust backend structured with clear module separation: `commands/` (Tauri command handlers), `storage/` (JSON file read/write/watch), `db/` (SQLite operations), `models/` (shared types and serde structs), `stats/` (aggregation logic for the dashboard).
- Frontend structured by feature: `features/issues/`, `features/dashboard/`, `features/roadmap/`, `features/projects/`, `features/settings/`, plus `shared/components/`, `shared/hooks/`, `shared/utils/`, `lib/api.ts` (typed Tauri invoke wrappers).
- All Tauri commands return `Result<T, String>` (or a custom serializable error type) so the frontend always receives structured errors. Frontend shows toast notifications for errors and success messages.
- No `.unwrap()` in Rust production code paths. All filesystem and database errors are propagated gracefully to the frontend with user-friendly messages.

### README.md
Provide a comprehensive README with:
- Project overview and screenshots (describe expected appearance in text since actual screenshots can't be generated).
- **Quick Start:** Prerequisites (Rust toolchain, Node.js 20+, platform-specific Tauri dependencies per https://tauri.app/start/prerequisites/), then `npm install` and `npm run tauri dev` to launch in development mode.
- **Building:** Instructions for `npm run tauri build` and where to find the output installer for each platform.
- **Usage Guide:** How to add a project (browse or drag-and-drop), create bugs and feature requests, use the Kanban board, read the dashboard, use the roadmap view.
- **`repotrack.json` Specification:** Full schema documentation including shared fields, bug-specific fields, and feature-specific fields, so advanced users understand the file format.
- **Git Workflow Tips:** Recommendations for committing `repotrack.json` (e.g., use a `.gitattributes` entry to mark it as a generated file, suggested commit message conventions).
- **Architecture Overview:** Description of the Tauri IPC model, how Rust commands work, how file-watching triggers frontend updates, and the role of the internal SQLite database vs. the JSON files.
- **Development Guide:** Project structure walkthrough, how to add a new Tauri command, how to add a new frontend feature.

---

## Deliverables
Provide the complete project as a set of files with their full paths, ready to be placed in a project directory and launched with `npm run tauri dev`. Include:
- `package.json` (root — includes scripts for `tauri dev` and `tauri build`)
- `src-tauri/` — Tauri Rust backend:
  - `Cargo.toml`
  - `tauri.conf.json`
  - `src/main.rs`
  - `src/commands/` — all Tauri command handler modules
  - `src/storage/` — JSON file read/write/watch logic
  - `src/db/` — SQLite setup and queries
  - `src/models/` — shared Rust structs with serde derives
  - `src/stats/` — dashboard aggregation logic
  - `migrations/` — SQLite schema migration SQL files
- `src/` — React frontend:
  - `index.html`
  - `vite.config.ts`
  - `tailwind.config.js`
  - `tsconfig.json`
  - `src/App.tsx`, `src/main.tsx`
  - `src/lib/api.ts` — typed Tauri invoke wrappers
  - `src/features/` — feature modules (issues, dashboard, roadmap, projects, settings)
  - `src/shared/` — shared components, hooks, utils
- `example/repotrack.json` — A sample file pre-populated with 20–25 realistic example issues: roughly 12 bugs and 10 feature requests, plus a few improvements and tasks, spread across different statuses, severities/priorities, types, and tags, with comments, votes on features, roadmap quarter assignments, and activity history, so the dashboard and roadmap views are visually rich on first launch.
- `README.md`
