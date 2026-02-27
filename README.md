# RepoTrack

A cross-platform desktop application for lightweight issue and feature request tracking that lives inside your project repositories. Built with Tauri (Rust backend + React frontend).

Instead of storing data in a centralized database, each project's issues and feature requests are written to a `repotrack.json` file at the root of the project repo. All interaction happens through a polished, modern GUI. The file is designed for clean git diffs, making it easy to track changes across your team.

## Features

- **File-Backed Storage** — Issues stored as `repotrack.json` in your project repo, version-controlled with git
- **Dual Workstreams** — Dedicated views for Bugs (severity, steps to reproduce, environment) and Feature Requests (priority, votes, acceptance criteria, roadmap)
- **Issue Board** — Sortable/filterable table view and drag-and-drop Kanban board
- **Dashboard Analytics** — Rich charts including burndown, status distribution, severity breakdown, resolution time histograms, tag treemaps, and activity feeds
- **Feature Roadmap** — Visual board-style roadmap with drag-and-drop quarter assignment and voting
- **Dark Mode First** — Beautiful dark theme with light mode support and system preference detection
- **Export** — CSV and Markdown export with native save dialogs
- **Cross-Platform** — macOS, Windows, and Linux via Tauri

## Quick Start

### Prerequisites

- **Rust toolchain** (1.70+) — Install from [rustup.rs](https://rustup.rs)
- **Node.js 20+** — Install from [nodejs.org](https://nodejs.org)
- **Platform-specific Tauri dependencies** — See [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

### Development

```bash
# Install dependencies
npm install

# Launch in development mode (hot-reload frontend, Rust recompilation)
npm run tauri dev
```

### Building

```bash
# Build distributable application
npm run tauri build
```

Output location varies by platform:
- **macOS:** `src-tauri/target/release/bundle/dmg/`
- **Windows:** `src-tauri/target/release/bundle/msi/`
- **Linux:** `src-tauri/target/release/bundle/appimage/` and `src-tauri/target/release/bundle/deb/`

## Usage Guide

### Adding a Project

1. Click **Open Project** on the home screen
2. Select a project directory using the native folder picker
3. If a `repotrack.json` exists, the project loads immediately
4. If not, you'll be prompted to create one — enter a project name and click Create

### Creating Issues

1. Click the **New Issue** button (top right of the issue board)
2. Select the issue type: Bug, Feature, Improvement, or Task
3. Fill in the details — fields adapt based on the type:
   - **Bugs:** Severity, steps to reproduce, expected/actual behavior, environment
   - **Features:** Priority, use case, acceptance criteria, roadmap quarter
4. Add tags, linked files, and time estimates as needed
5. Click **Create Issue** (or Ctrl/Cmd+Enter)

### Using the Kanban Board

- Toggle between **Table** and **Kanban** view using the layout switcher
- Drag cards between columns to change status
- Cards are sorted by severity/priority within columns

### Reading the Dashboard

- **Overview** tab shows key metrics, burndown charts, and status distribution
- **Bugs** tab focuses on bug health: severity breakdown, oldest bugs, resolution velocity
- **Features** tab shows the feature funnel, top voted features, and roadmap by quarter

### Feature Roadmap

- A dedicated board view showing features organized by roadmap quarter
- Drag features between quarters to reassign
- Vote on features to signal demand
- Filter by priority, status, or tag

## `repotrack.json` Specification

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version (`"1.0"`) |
| `project_name` | string | Display name for the project |
| `created_at` | ISO 8601 | When the file was created |
| `updated_at` | ISO 8601 | Last modification timestamp |
| `issues` | array | Array of issue objects |

### Shared Issue Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated: `BUG-0001`, `FEAT-0001`, `IMP-0001`, `TASK-0001` |
| `title` | string | Short summary (max 200 chars) |
| `description` | string | Detailed description (Markdown) |
| `type` | string | `bug`, `feature`, `improvement`, `task` |
| `status` | string | Status (depends on type) |
| `tags` | string[] | Freeform categorization tags |
| `created_at` | ISO 8601 | Creation timestamp |
| `updated_at` | ISO 8601 | Last update timestamp |
| `resolved_at` | ISO 8601 \| null | When the issue was resolved |
| `comments` | Comment[] | Array of `{id, text, created_at}` |
| `linked_files` | string[] | Relative file paths within the project |
| `time_estimate_hours` | number \| null | Estimated hours |
| `time_spent_hours` | number \| null | Actual hours spent |

### Bug-Specific Fields

| Field | Type | Values |
|-------|------|--------|
| `severity` | string | `critical`, `high`, `medium`, `low` |
| `status` | string | `open`, `in-progress`, `resolved`, `closed`, `wont-fix` |
| `steps_to_reproduce` | string | Markdown |
| `expected_behavior` | string | |
| `actual_behavior` | string | |
| `environment` | string | Freeform (e.g., "Chrome 122, macOS 14.3") |

### Feature-Specific Fields

| Field | Type | Values |
|-------|------|--------|
| `priority` | string | `critical`, `high`, `medium`, `low` |
| `status` | string | `proposed`, `under-review`, `planned`, `in-progress`, `completed`, `declined` |
| `use_case` | string | Markdown |
| `acceptance_criteria` | string | Markdown (supports `- [ ]` checklists) |
| `votes` | number | Upvote count (default 0) |
| `roadmap_quarter` | string \| null | e.g., `"Q2 2026"`, `"Backlog"` |

## Git Workflow Tips

- Add `repotrack.json` to version control — it's designed for clean diffs
- Consider adding to `.gitattributes`: `repotrack.json linguist-generated=true`
- Suggested commit message convention: `chore(repotrack): update issue tracking data`
- If a teammate updates the file, their changes will be picked up on the next `git pull`

## Architecture

### Tauri IPC Model

The app uses Tauri's command system for all data operations:

```
React Frontend ──invoke()──> Rust Backend ──> Filesystem / SQLite
                                  │
                             ┌────┴────┐
                             │  State  │  (Mutex<ActiveProject>)
                             └────┬────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼              ▼
              repotrack.json   SQLite DB    File Watcher
              (per project)   (app data)    (notify crate)
```

- **Frontend** calls Rust commands via `invoke()` with typed wrappers
- **Backend** holds the active project in managed state behind a `Mutex`
- **Every mutation** writes back to `repotrack.json` immediately
- **SQLite** stores project registry, user preferences, and activity log
- The JSON file is always the source of truth for issue data

### Project Structure

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── src/
│   ├── main.rs              # Entry point
│   ├── lib.rs               # Tauri app setup, plugin registration
│   ├── commands/mod.rs       # All Tauri command handlers
│   ├── storage/mod.rs        # JSON file read/write operations
│   ├── db/mod.rs             # SQLite setup and queries
│   ├── models/mod.rs         # Shared types with serde derives
│   └── stats/mod.rs          # Dashboard aggregation logic
src/
├── main.tsx                  # React entry point
├── App.tsx                   # Root component with routing
├── index.css                 # Global styles + Tailwind
├── lib/
│   ├── api.ts                # Typed Tauri invoke wrappers
│   ├── store.ts              # Zustand global state
│   └── types.ts              # TypeScript type definitions
├── features/
│   ├── issues/               # Issue board, detail, new issue form, kanban
│   ├── dashboard/            # Overview, bugs, and features dashboards
│   ├── roadmap/              # Feature roadmap board
│   ├── projects/             # Project selector
│   └── settings/             # App settings
└── shared/
    └── components/           # Modal, Toast, StatusBadge, Sidebar
```

### Adding a New Tauri Command

1. Add the handler function in `src-tauri/src/commands/mod.rs` with the `#[tauri::command]` attribute
2. Register it in `src-tauri/src/lib.rs` inside `invoke_handler(tauri::generate_handler![...])`
3. Add a typed wrapper in `src/lib/api.ts`

## Development Guide

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Tauri v2 |
| Backend | Rust (tokio, serde, rusqlite) |
| Frontend | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| State | Zustand + React Query |
| Routing | React Router v6 |

### Key Design Decisions

- **No component library** — All UI components built from scratch with Tailwind for a custom feel
- **Dark mode first** — Dark theme designed as primary, with equally polished light mode
- **File as source of truth** — The JSON file can be manually edited, committed by teammates, or generated by scripts
- **SQLite for metadata only** — Project registry, preferences, and activity log. Never the source of truth for issues

## License

MIT
