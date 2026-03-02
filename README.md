# RepoTrack

A cross-platform desktop application for lightweight issue and feature request tracking that lives inside your project repositories. Built with Tauri (Rust backend + React frontend).

Instead of storing data in a centralized database, each project's issues and feature requests are written to a `.repotrack/` directory at the root of your project repo. Each issue lives in its own directory with an `issue.json` file, making diffs clean and merges painless. All interaction happens through a polished, modern GUI.

![RepoTrack Issue Board](readme_resources/RepoTrackImg1.png)

## Features

- **Directory-Based Storage** — Each issue gets its own directory under `.repotrack/issues/`, version-controlled with git for clean diffs and easy merges
- **File Attachments** — Attach screenshots, logs, and documents directly to issues. Image attachments render inline thumbnails with a full-size lightbox preview
- **Dual Workstreams** — Dedicated views for Bugs (severity, steps to reproduce, environment) and Feature Requests (priority, votes, acceptance criteria, roadmap)
- **Issue Board** — Sortable/filterable table view and drag-and-drop Kanban board
- **Dashboard Analytics** — Rich charts including burndown, status distribution, severity breakdown, resolution time histograms, tag treemaps, and activity feeds
- **Feature Roadmap** — Visual board-style roadmap with drag-and-drop quarter assignment and voting
- **Dark Mode First** — Beautiful dark theme with light mode support and system preference detection
- **Export** — CSV and Markdown export with native save dialogs
- **Legacy Migration** — One-click migration from the old single-file `repotrack.json` format to the new directory format
- **Cross-Platform** — macOS, Windows, and Linux via Tauri

## Do You Just Want the App?

Download the Mac `.dmg` or Windows `.msi` installer from the [latest release](https://github.com/NRohner/RepoTrack/releases/tag/v0.3.0).

### Windows

Windows Defender may flag the app when using the MSI installer. This is expected — the app is not currently code-signed. Click **"More info"** → **"Run anyway"** to proceed.

### Mac

macOS Gatekeeper will likely block the app after installation with an error that says:

> "RepoTrack" is damaged and can't be opened. You should move it to the Trash.

The app is not actually damaged. This happens because it is not currently signed with an Apple Developer certificate. To bypass this, run the following command in Terminal:

```bash
# Adjust the path if your app is installed elsewhere
xattr -cr /Applications/RepoTrack.app
```

After that, the app should open normally.


## Quick Start 

### Prerequisites

- **Rust toolchain** (1.70+) — Install from [rustup.rs](https://rustup.rs)
- **Node.js 20+** — Install from [nodejs.org](https://nodejs.org)
- **Platform-specific Tauri dependencies** — See [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

### OAuth Setup (Optional)

RepoTrack supports optional sign-in with GitHub and Google so that issues, comments, and status changes are attributed to the signed-in user. If you don't configure OAuth, everything works normally — actions are attributed to "anon".

**1. GitHub OAuth App**

1. Go to [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `RepoTrack`
   - **Homepage URL**: any URL (e.g., your repo URL)
   - **Authorization callback URL**: `http://127.0.0.1/callback`
4. Click **"Register application"**
5. Copy the **Client ID** and paste it into `src-tauri/src/auth/config.rs` as `GITHUB_CLIENT_ID`
6. Click **"Generate a new client secret"**, copy it — this goes in your environment (see below)

**2. Google OAuth App**

1. Go to [Google Cloud Console → Auth Platform](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Create an OAuth client:
   - **Application type**: Desktop app
   - **Name**: `RepoTrack Desktop`
4. Copy the **Client ID** and paste it into `src-tauri/src/auth/config.rs` as `GOOGLE_CLIENT_ID`
5. Copy the **Client Secret** — this goes in your `.env` file (see below)

**3. Client Secrets**

The client secrets must **not** be committed to git. Create a `.env` file in the project root (already in `.gitignore`):

```
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

The build script reads `.env` automatically at compile time — no need to export anything.

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
3. If a `.repotrack/` directory (or legacy `repotrack.json`) exists, the project loads immediately
4. If not, you'll be prompted to create one — enter a project name and click Create
5. New projects always use the directory storage format

### Creating Issues

1. Click the **New Issue** button (top right of the issue board)
2. Select the issue type: Bug, Feature, Improvement, or Task
3. Fill in the details — fields adapt based on the type:
   - **Bugs:** Severity, steps to reproduce, expected/actual behavior, environment
   - **Features:** Priority, use case, acceptance criteria, roadmap quarter
4. Add tags, linked files, and time estimates as needed
5. Optionally attach files (screenshots, logs, etc.) — these are copied into the issue's directory
6. Click **Create Issue** (or Ctrl/Cmd+Enter)

### Attaching Files to Issues

1. Open an issue and scroll to the **Attachments** section
2. Click **Attach File** and select one or more files from your system
3. Files are copied into `.repotrack/issues/{type}-{uuid}/attachments/`
4. Image files (PNG, JPG, GIF, WebP, SVG) display inline thumbnails
5. Click a thumbnail to open a full-size in-app lightbox preview
6. Click the filename to open the file in your system's default application
7. Attachments require directory storage format — legacy projects show an upgrade prompt

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

## Storage Format

### Directory Structure (default)

New projects use the directory format. Each issue lives in its own directory:

```
your-project/
└── .repotrack/
    ├── project.json                          # Project metadata and ID counters
    └── issues/
        ├── bug-a1b2c3d4/
        │   ├── issue.json                    # Issue data
        │   └── attachments/                  # File attachments
        │       ├── screenshot.png
        │       └── error-log.txt
        └── feat-e5f6g7h8/
            └── issue.json
```

### `project.json` Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version |
| `project_name` | string | Display name for the project |
| `created_at` | ISO 8601 | When the project was created |
| `updated_at` | ISO 8601 | Last modification timestamp |
| `id_counters` | object | Counters per issue type for generating IDs (`{"bug": 3, "feature": 5}`) |

### Legacy Format

Older projects may use a single `repotrack.json` file at the repo root containing all issues in one array. This format is still supported but does not support file attachments. Use the in-app migration button to upgrade to directory format.

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
| `comments` | Comment[] | Array of `{id, text, created_at, created_by?}` |
| `attachments` | Attachment[] | Array of file attachment metadata (directory format only) |
| `linked_files` | string[] | Relative file paths within the project |
| `time_estimate_hours` | number \| null | Estimated hours |
| `time_spent_hours` | number \| null | Actual hours spent |

### Attachment Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated: `att-0001`, `att-0002`, etc. |
| `filename` | string | Stored filename (deduplicated if needed) |
| `size_bytes` | number | File size in bytes |
| `created_at` | ISO 8601 | When the file was attached |
| `created_by` | UserInfo \| null | User who attached the file |

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

- Add the `.repotrack/` directory to version control — it's designed for clean diffs
- Each issue is a separate file, so concurrent edits to different issues won't conflict
- Consider adding to `.gitattributes`: `.repotrack/** linguist-generated=true`
- For large binary attachments, consider using [Git LFS](https://git-lfs.github.com/) for the `attachments/` directories
- Suggested commit message convention: `chore(repotrack): update issue tracking data`
- If a teammate updates issues, their changes will be picked up on the next `git pull`

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
              .repotrack/     SQLite DB     Attachments
              (per project)   (app data)    (binary files)
```

- **Frontend** calls Rust commands via `invoke()` with typed wrappers
- **Backend** holds the active project in managed state behind a `Mutex`
- **Every mutation** writes back to the issue's `issue.json` immediately
- **Attachments** are copied into each issue's `attachments/` subdirectory; image data is served to the frontend as base64 data URLs
- **SQLite** stores project registry, user preferences, and activity log
- The `.repotrack/` directory is always the source of truth for issue data

### Project Structure

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── src/
│   ├── main.rs              # Entry point
│   ├── lib.rs               # Tauri app setup, plugin registration
│   ├── commands/mod.rs       # All Tauri command handlers
│   ├── auth/mod.rs           # OAuth sign-in flow (GitHub, Google)
│   ├── auth/config.rs        # OAuth client IDs and URLs
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
- **Filesystem as source of truth** — Issue JSON files can be manually edited, committed by teammates, or generated by scripts
- **SQLite for metadata only** — Project registry, preferences, and activity log. Never the source of truth for issues

## License

MIT
