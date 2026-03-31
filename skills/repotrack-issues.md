# RepoTrack Issue Management

RepoTrack stores issues as JSON files inside `.repotrack/` at the project root, version-controlled alongside code.

## Directory Structure

```
.repotrack/
├── project.json                  # Project metadata & ID counters
└── issues/
    └── {type_prefix}-{uuid}/
        ├── issue.json
        └── attachments/
```

Issue directories are named `<type-prefix>-<uuid>`, where the prefix is `bug`, `feat`, `imp`, or `task`, and the UUID is the first 8 characters of a v4 UUID.

## Reference

### `project.json` Fields

| Field | Type | Description |
|-------|------|-------------|
| `_repotrack` | string | Notice: `"This file is managed by RepoTrack..."` (constant) |
| `version` | string | RepoTrack app version (e.g., `"0.5.0"`) |
| `project_name` | string | Display name for the project |
| `created_at` | ISO 8601 | When the project was created |
| `updated_at` | ISO 8601 | Last modification timestamp |
| `id_counters` | object | Counters per issue type for generating display IDs (`{"bug": 3, "feature": 5, "improvement": 1, "task": 0}`) |

### Issue Types

| Type | ID Prefix | Dir Prefix | Counter Key | Extra Fields |
|---|---|---|---|---|
| bug | `BUG-` | `bug-` | `"bug"` | `severity`, `steps_to_reproduce`, `expected_behavior`, `actual_behavior`, `environment` |
| feature | `FEAT-` | `feat-` | `"feature"` | `priority`, `use_case`, `acceptance_criteria`, `votes`, `roadmap_quarter` |
| improvement | `IMP-` | `imp-` | `"improvement"` | `severity` |
| task | `TASK-` | `task-` | `"task"` | `priority` |

### Statuses (all types)
`open` · `in-progress` · `completed` · `wont-fix`

### Severity / Priority
`critical` · `high` · `medium` · `low`

### Shared Issue Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated display ID: `BUG-0001`, `FEAT-0001`, `IMP-0001`, `TASK-0001` |
| `uuid` | string | 8-character hex string (first 8 chars of a v4 UUID), used in directory naming |
| `title` | string | Short summary |
| `description` | string | Detailed description (Markdown) |
| `type` | string | `bug`, `feature`, `improvement`, `task` |
| `status` | string | `open`, `in-progress`, `completed`, `wont-fix` |
| `tags` | string[] | Freeform categorization tags |
| `created_at` | ISO 8601 | Creation timestamp |
| `updated_at` | ISO 8601 | Last update timestamp |
| `resolved_at` | ISO 8601 \| null | When the issue was resolved |
| `comments` | Comment[] | Array of comment objects |
| `attachments` | Attachment[] | Array of attachment metadata (directory format only) |
| `linked_files` | string[] | Relative file paths within the project |
| `time_estimate_hours` | number \| null | Estimated hours |
| `time_spent_hours` | number \| null | Actual hours spent |
| `created_by` | UserInfo \| null | User who created the issue |
| `history` | HistoryEntry[] | Audit log of all changes to the issue |

Optional fields (`severity`, `priority`, `steps_to_reproduce`, `votes`, `roadmap_quarter`, etc.) are omitted from the JSON when null or empty.

### Comment Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated within the issue: `CMT-0001`, `CMT-0002`, etc. |
| `text` | string | Comment text (Markdown) |
| `created_at` | ISO 8601 | When the comment was posted |
| `created_by` | UserInfo \| null | User who posted the comment (omitted for anonymous) |

### Attachment Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated within the issue: `att-0001`, `att-0002`, etc. |
| `filename` | string | Stored filename (deduplicated if needed) |
| `size_bytes` | number | File size in bytes |
| `created_at` | ISO 8601 | When the file was attached |
| `created_by` | UserInfo \| null | User who attached the file |

Actual attachment files are stored at `.repotrack/issues/<type>-<uuid>/attachments/<filename>`.

### History Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `action` | string | `created`, `status_changed`, `comment_added`, `attachment_added` |
| `from` | string \| null | Previous value (used by `status_changed`) |
| `to` | string \| null | New value (used by `status_changed` and `attachment_added`) |
| `user` | UserInfo | User who performed the action |
| `timestamp` | ISO 8601 | When the action occurred |

### UserInfo Fields

User attribution is attached to issues, comments, attachments, and history entries. When no user is signed in, actions are attributed to `"anon"`.

| Field | Type | Description |
|-------|------|-------------|
| `display_name` | string | User's display name |
| `username` | string | Username or handle |
| `provider` | string | Auth provider: `"github"`, `"google"`, or `"anon"` |
| `avatar_url` | string \| null | Profile picture URL |

---

## Reading & Querying Issues

- **List all:** Glob `.repotrack/issues/*/issue.json` and read each file.
- **Find by ID:** Grep for the ID (e.g. `BUG-0002`) across `.repotrack/issues/*/issue.json`.
- **Filter:** Read all files and filter in memory by `type`, `status`, `severity`, `priority`, `tags`, or `linked_files`.
- **Comments:** Read all comments associated with an issue. Comments may sometimes include additional important information that is not mentioned in other issue fields.

---

## Creating an Issue

1. Read `.repotrack/project.json` and get the current counter for the type (if missing, start at `1`).
2. The new ID is the current counter value (zero-padded to 4 digits), e.g. counter `11` → `BUG-0011`.
3. Increment the counter and write it back to `project.json` with an updated `updated_at`.
4. Generate a random 8-character lowercase hex UUID (e.g. `a3f1b9c2`).
5. Create directory `.repotrack/issues/{type_prefix}-{uuid}/`.
6. Write `issue.json` using the appropriate template below.

### Templates

**Bug**
```json
{
  "id": "BUG-XXXX", "uuid": "xxxxxxxx", "title": "", "description": "",
  "type": "bug", "severity": "medium", "status": "open", "tags": [],
  "created_at": "", "updated_at": "", "resolved_at": null,
  "steps_to_reproduce": "", "expected_behavior": "", "actual_behavior": "", "environment": "",
  "comments": [], "attachments": [], "linked_files": [],
  "time_estimate_hours": null, "time_spent_hours": null, "created_by": null,
  "history": [{ "action": "created", "user": { "display_name": "anon", "username": "anon", "provider": "anon" }, "timestamp": "" }]
}
```

**Feature**
```json
{
  "id": "FEAT-XXXX", "uuid": "xxxxxxxx", "title": "", "description": "",
  "type": "feature", "priority": "medium", "status": "open", "tags": [],
  "created_at": "", "updated_at": "", "resolved_at": null,
  "votes": 0, "roadmap_quarter": "Backlog", "use_case": "", "acceptance_criteria": "",
  "comments": [], "attachments": [], "linked_files": [],
  "time_estimate_hours": null, "time_spent_hours": null, "created_by": null,
  "history": [{ "action": "created", "user": { "display_name": "anon", "username": "anon", "provider": "anon" }, "timestamp": "" }]
}
```

**Improvement**
```json
{
  "id": "IMP-XXXX", "uuid": "xxxxxxxx", "title": "", "description": "",
  "type": "improvement", "severity": "medium", "status": "open", "tags": [],
  "created_at": "", "updated_at": "", "resolved_at": null,
  "comments": [], "attachments": [], "linked_files": [],
  "time_estimate_hours": null, "time_spent_hours": null, "created_by": null,
  "history": [{ "action": "created", "user": { "display_name": "anon", "username": "anon", "provider": "anon" }, "timestamp": "" }]
}
```

**Task**
```json
{
  "id": "TASK-XXXX", "uuid": "xxxxxxxx", "title": "", "description": "",
  "type": "task", "priority": "medium", "status": "open", "tags": [],
  "created_at": "", "updated_at": "", "resolved_at": null,
  "comments": [], "attachments": [], "linked_files": [],
  "time_estimate_hours": null, "time_spent_hours": null, "created_by": null,
  "history": [{ "action": "created", "user": { "display_name": "anon", "username": "anon", "provider": "anon" }, "timestamp": "" }]
}
```

---

## Updating an Issue

Always update `updated_at` when writing any change. Only modify the fields being changed.

Editable fields: `title`, `description`, `severity`/`priority`, `tags`, `linked_files`, `time_estimate_hours`, `time_spent_hours`, `roadmap_quarter`, `use_case`, `acceptance_criteria`, `steps_to_reproduce`, `expected_behavior`, `actual_behavior`, `environment`.

Change issue status to in progress when working on or addressing an issue but NEVER mark an issue as completed or wont fix without asking the user first to confirm that the issues is fully addressed and ready to be marked complete.
---

## Changing Status

1. Note the current `status` as `from`.
2. Set `status` to the new value and update `updated_at`.
3. If new status is `completed` → set `resolved_at` to now. If moving away from `completed` → set `resolved_at` to `null`.
4. Append to `history`: `{ "action": "status_changed", "from": "...", "to": "...", "user": { ... }, "timestamp": "" }`

---

## Adding a Comment

1. Find the highest `CMT-XXXX` number in `comments` and increment (start at `CMT-0001` if none).
2. Append to `comments`: `{ "id": "CMT-XXXX", "text": "", "created_at": "", "created_by": null }`
3. Append to `history`: `{ "action": "comment_added", "user": { "display_name": "anon", "username": "anon", "provider": "anon" }, "timestamp": "" }`
4. Update `updated_at`.

---

## Deleting an Issue

Remove the entire directory `.repotrack/issues/{type}-{uuid}/`. Do **not** decrement the ID counter — IDs are never reused.

---

## Timestamps

All timestamps use ISO 8601 UTC with microsecond precision: `2026-03-19T12:00:00.000000Z`

---

## Git

> **Always stage `.repotrack/` changes when committing** — never leave issue data behind.

Issue-only commit message format:
- `repotrack: add BUG-0012 - short title`
- `repotrack: close FEAT-0003 - short title`
- `repotrack: add comment to IMP-0002`

## Working with Repotrack
The following are best practices for claude when working with repotrack
1. When asked to address an issue from repotrack, update the status to "In Progress"
2. All repotrack issue changes made by claude should be attributed to "Claude" rather than "anon"
3. Claude should leave a descriptive but conscise comment trail explaining the big pictures changes made to address each issue.
4. After finishing an issue, never mark the issue as "Completed" without first asking the user if that is ok. User confirmation that the change is completed to their satisfaciton is required before marking an issue as completed.
