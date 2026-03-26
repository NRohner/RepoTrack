# RepoTrack Issue Management Skill

> **How to use:** Copy this file into any project that uses RepoTrack as its `CLAUDE.md` (or include it via reference) so that Claude Code can read, create, update, and manage issues directly from the CLI.

## What is RepoTrack?

RepoTrack is a lightweight issue tracker that stores all data as JSON files inside a `.repotrack/` directory at the project root. Issues are version-controlled alongside code via Git.

## .repotrack/ Directory Structure

```
.repotrack/
├── project.json                    # Project metadata & ID counters
└── issues/
    └── {type_prefix}-{8char_uuid}/
        ├── issue.json              # All issue data
        └── attachments/            # File attachments (images, docs, etc.)
```

- `type_prefix` is one of: `bug`, `feat`, `imp`, `task`
- `8char_uuid` is a lowercase hex string (e.g., `40ccfce4`)

---

## Reading Issues

### List all issues
Glob for `.repotrack/issues/*/issue.json` and read each file.

### Find a specific issue by ID
Issue IDs look like `BUG-0002`, `FEAT-0003`, `IMP-0001`, `TASK-0001`. To find one, grep for the ID across `.repotrack/issues/*/issue.json`, or scan the `"id"` field in each file.

### View attachments
Attachments are files stored in `.repotrack/issues/{type}-{uuid}/attachments/`. The `attachments` array in `issue.json` contains metadata (id, filename, size_bytes, created_at, created_by). To view an image attachment, read the file at that path.

---

## Issue Types & ID Prefixes

| Type        | Prefix  | Counter Key   | Directory Prefix | Type-Specific Fields |
|-------------|---------|---------------|------------------|---------------------|
| bug         | `BUG-`  | `"bug"`       | `bug-`           | severity, steps_to_reproduce, expected_behavior, actual_behavior, environment |
| feature     | `FEAT-` | `"feature"`   | `feat-`          | priority, use_case, acceptance_criteria, votes, roadmap_quarter |
| improvement | `IMP-`  | `"improvement"`| `imp-`          | severity |
| task        | `TASK-` | `"task"`      | `task-`          | severity |

## Issue Statuses

| Status        | Meaning                                    |
|---------------|--------------------------------------------|
| `open`        | Not yet started                            |
| `in-progress` | Currently being worked on                  |
| `completed`   | Done (sets `resolved_at` timestamp)        |
| `wont-fix`    | Decided not to address                     |

## Severity / Priority Values

`critical`, `high`, `medium`, `low`

---

## Creating a New Issue

Follow these steps exactly:

### Step 1: Read project.json to get current counters
```
Read .repotrack/project.json
```
The `id_counters` object tracks the next number for each type. Example:
```json
{ "bug": 11, "feature": 10, "improvement": 5 }
```
This means the next bug would be `BUG-0011`, the next feature `FEAT-0010`, etc.

### Step 2: Increment the counter
Add 1 to the relevant counter. If the counter key doesn't exist yet (e.g., `"task"` for the first task), start at 1.

### Step 3: Generate an 8-character hex UUID
Use a random 8-character lowercase hex string. Example: `a3f1b9c2`

### Step 4: Create the issue directory
```
.repotrack/issues/{type_prefix}-{uuid}/
```
Where `type_prefix` is `bug`, `feat`, `imp`, or `task`.

### Step 5: Write issue.json

**Bug template:**
```json
{
  "id": "BUG-XXXX",
  "uuid": "xxxxxxxx",
  "title": "Short title",
  "description": "Detailed markdown description",
  "type": "bug",
  "severity": "medium",
  "status": "open",
  "tags": [],
  "created_at": "<ISO 8601 UTC>",
  "updated_at": "<ISO 8601 UTC>",
  "resolved_at": null,
  "steps_to_reproduce": "",
  "expected_behavior": "",
  "actual_behavior": "",
  "environment": "",
  "comments": [],
  "attachments": [],
  "linked_files": [],
  "time_estimate_hours": null,
  "time_spent_hours": null,
  "created_by": null,
  "history": [
    {
      "action": "created",
      "timestamp": "<ISO 8601 UTC>"
    }
  ]
}
```

**Feature template:**
```json
{
  "id": "FEAT-XXXX",
  "uuid": "xxxxxxxx",
  "title": "Short title",
  "description": "Detailed markdown description",
  "type": "feature",
  "priority": "medium",
  "status": "open",
  "tags": [],
  "created_at": "<ISO 8601 UTC>",
  "updated_at": "<ISO 8601 UTC>",
  "resolved_at": null,
  "votes": 0,
  "roadmap_quarter": "Backlog",
  "use_case": "",
  "acceptance_criteria": "",
  "comments": [],
  "attachments": [],
  "linked_files": [],
  "time_estimate_hours": null,
  "time_spent_hours": null,
  "created_by": null,
  "history": [
    {
      "action": "created",
      "timestamp": "<ISO 8601 UTC>"
    }
  ]
}
```

**Improvement template:**
```json
{
  "id": "IMP-XXXX",
  "uuid": "xxxxxxxx",
  "title": "Short title",
  "description": "Detailed markdown description",
  "type": "improvement",
  "severity": "medium",
  "status": "open",
  "tags": [],
  "created_at": "<ISO 8601 UTC>",
  "updated_at": "<ISO 8601 UTC>",
  "resolved_at": null,
  "comments": [],
  "attachments": [],
  "linked_files": [],
  "time_estimate_hours": null,
  "time_spent_hours": null,
  "created_by": null,
  "history": [
    {
      "action": "created",
      "timestamp": "<ISO 8601 UTC>"
    }
  ]
}
```

**Task template:**
```json
{
  "id": "TASK-XXXX",
  "uuid": "xxxxxxxx",
  "title": "Short title",
  "description": "Detailed markdown description",
  "type": "task",
  "severity": "medium",
  "status": "open",
  "tags": [],
  "created_at": "<ISO 8601 UTC>",
  "updated_at": "<ISO 8601 UTC>",
  "resolved_at": null,
  "comments": [],
  "attachments": [],
  "linked_files": [],
  "time_estimate_hours": null,
  "time_spent_hours": null,
  "created_by": null,
  "history": [
    {
      "action": "created",
      "timestamp": "<ISO 8601 UTC>"
    }
  ]
}
```

### Step 6: Update project.json
Write back `project.json` with the incremented counter and an updated `updated_at` timestamp.

---

## Changing Issue Status

1. Read the issue's `issue.json`
2. Note the current `status` value (this is the `"from"` value)
3. Set `status` to the new value
4. Set `updated_at` to the current ISO 8601 UTC timestamp
5. If new status is `completed`: set `resolved_at` to the current timestamp
6. If old status was `completed` and new status is not: set `resolved_at` to `null`
7. Append a history entry:
   ```json
   {
     "action": "status_changed",
     "from": "<old_status>",
     "to": "<new_status>",
     "timestamp": "<ISO 8601 UTC>"
   }
   ```
8. Write back the updated `issue.json`

---

## Adding Comments

1. Read the issue's `issue.json`
2. Determine the next comment ID: look at the existing `comments` array, find the highest `CMT-XXXX` number, and increment. If no comments exist, use `CMT-0001`.
3. Append to the `comments` array:
   ```json
   {
     "id": "CMT-XXXX",
     "text": "Comment text (supports markdown)",
     "created_at": "<ISO 8601 UTC>",
     "created_by": null
   }
   ```
4. Append a history entry:
   ```json
   {
     "action": "comment_added",
     "timestamp": "<ISO 8601 UTC>"
   }
   ```
5. Update `updated_at` and write back `issue.json`

---

## Updating Issue Fields

Any field can be updated by editing the `issue.json` directly. Always:
- Update the `updated_at` timestamp
- For status changes, follow the full status change procedure above
- Keep the existing data intact; only modify the fields being changed

Editable fields include: `title`, `description`, `severity`/`priority`, `tags`, `linked_files`, `time_estimate_hours`, `time_spent_hours`, `roadmap_quarter`, `use_case`, `acceptance_criteria`, `steps_to_reproduce`, `expected_behavior`, `actual_behavior`, `environment`.

---

## Linking Files to Issues

Add relative file paths (from project root) to the `linked_files` array:
```json
"linked_files": ["src/components/App.tsx", "src/lib/api.ts"]
```

---

## Deleting an Issue

Remove the entire issue directory: `.repotrack/issues/{type}-{uuid}/`

This deletes the `issue.json` and all attachments. The ID counter in `project.json` is NOT decremented (IDs are never reused).

---

## Git & Committing .repotrack/ Changes

**CRITICAL:** The `.repotrack/` directory is version-controlled project data. When the user asks to commit and push:

1. **Always stage `.repotrack/` changes** alongside any code changes — never leave them behind
2. **Include `.repotrack/` in the commit** even if you only changed issue data and no code
3. Use descriptive commit messages for issue-only commits:
   - `repotrack: add BUG-0012 - title of the bug`
   - `repotrack: close FEAT-0003 - feature title`
   - `repotrack: update issue statuses`
   - `repotrack: add comment to IMP-0002`

If both code and issue changes are being committed together, use your normal commit message but ensure `.repotrack/` files are staged.

---

## Querying & Filtering Issues

To answer questions like "what bugs are open?" or "show me high-priority features":
1. Glob for `.repotrack/issues/*/issue.json`
2. Read each file and filter by the relevant fields (`type`, `status`, `severity`, `priority`, `tags`, etc.)

Common queries:
- **Open bugs:** `type == "bug" && status == "open"`
- **In-progress work:** `status == "in-progress"`
- **High-priority features:** `type == "feature" && priority == "high"`
- **Issues with attachments:** `attachments.length > 0`
- **Issues linked to a file:** check if a path appears in any issue's `linked_files`

---

## Timestamp Format

All timestamps must be ISO 8601 UTC with microsecond precision:
```
2026-03-19T12:00:00.000000Z
```

Generate with: `date -u +"%Y-%m-%dT%H:%M:%S.000000Z"` (or equivalent).

---

## Summary of History Actions

| Action              | Fields                        | When                        |
|---------------------|-------------------------------|-----------------------------|
| `created`           | timestamp                     | Issue created               |
| `status_changed`    | from, to, timestamp           | Status updated              |
| `comment_added`     | timestamp                     | Comment appended            |
| `attachment_added`  | to (filename), timestamp      | File attached               |
| `attachment_removed`| from (filename), timestamp    | File removed                |
