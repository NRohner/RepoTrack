# RepoTrack - Claude Code Guide

## What is RepoTrack?

RepoTrack is a cross-platform desktop app (Tauri v2 + React + Rust) for lightweight issue tracking that lives directly inside project repositories. All issues are stored as individual JSON files in a `.repotrack/` directory, making them Git-trackable and easy to merge.

## Tech Stack

- **Backend:** Rust (Tauri v2, serde, git2, rusqlite, tokio)
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Zustand, React Router v6
- **Storage:** `.repotrack/` directory (JSON files) + SQLite (app metadata only)

## Project Structure

```
src/                    # React frontend
src-tauri/src/          # Rust backend
  commands/mod.rs       # All IPC command handlers
  models/mod.rs         # Shared types (Issue, Comment, etc.)
  storage/mod.rs        # JSON file I/O
  db/mod.rs             # SQLite for projects/preferences/activity
  git/mod.rs            # Git integration
.repotrack/             # Issue database (committed to Git)
  project.json          # Project metadata & ID counters
  issues/               # One directory per issue
    {type}-{uuid}/
      issue.json
      attachments/
skills/                 # Shareable Claude Code skill files
```

## Build & Dev Commands

```bash
npm run dev          # Start Vite dev server (frontend only)
npm run tauri:dev    # Start full Tauri dev (frontend + backend)
npm run tauri:build  # Production build
```

## Issue Management

See **[skills/repotrack-issues.md](skills/repotrack-issues.md)** for the complete guide on:
- Reading, creating, updating, and deleting issues
- Changing issue statuses with proper history tracking
- Adding comments and linking files
- Viewing attachments
- Issue types, ID formats, statuses, severity/priority values
- Templates for all issue types (bug, feature, improvement, task)
- Querying and filtering issues

## Git & Committing .repotrack/ Changes

**IMPORTANT:** When the user asks to commit and push, ALWAYS include `.repotrack/` changes alongside any code changes. The `.repotrack/` directory is version-controlled data and must be committed like source code. Do not leave `.repotrack/` changes uncommitted when the user requests a commit/push.

When committing issue-only changes (no code), use a descriptive message like:
- `repotrack: add BUG-0012 - description`
- `repotrack: close FEAT-0003`
- `repotrack: update issue statuses`

## Code Conventions

- Rust backend uses `snake_case` for functions, `PascalCase` for types
- Frontend uses `camelCase` for variables/functions, `PascalCase` for components
- All timestamps are ISO 8601 UTC format with microsecond precision
- Issue descriptions and comments support Markdown
- UUIDs are 8-character lowercase hex strings
