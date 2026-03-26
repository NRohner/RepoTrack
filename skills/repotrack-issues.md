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

## Reference

### Issue Types

| Type | ID Prefix | Dir Prefix | Counter Key | Extra Fields |
|---|---|---|---|---|
| bug | `BUG-` | `bug-` | `"bug"` | `severity`, `steps_to_reproduce`, `expected_behavior`, `actual_behavior`, `environment` |
| feature | `FEAT-` | `feat-` | `"feature"` | `priority`, `use_case`, `acceptance_criteria`, `votes`, `roadmap_quarter` |
| improvement | `IMP-` | `imp-` | `"improvement"` | `severity` |
| task | `TASK-` | `task-` | `"task"` | `severity` |

### Statuses
`open` · `in-progress` · `completed` · `wont-fix`

### Severity / Priority
`critical` · `high` · `medium` · `low`

---

## Reading & Querying Issues

- **List all:** Glob `.repotrack/issues/*/issue.json` and read each file.
- **Find by ID:** Grep for the ID (e.g. `BUG-0002`) across `.repotrack/issues/*/issue.json`.
- **Filter:** Read all files and filter in memory by `type`, `status`, `severity`, `priority`, `tags`, or `linked_files`.
- **Comments:** Read all comments associated with an issue. Comments may somtimes include additional important information that is not mentioned in other issue fields.

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
  "history": [{ "action": "created", "timestamp": "" }]
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
  "history": [{ "action": "created", "timestamp": "" }]
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
  "history": [{ "action": "created", "timestamp": "" }]
}
```

**Task**
```json
{
  "id": "TASK-XXXX", "uuid": "xxxxxxxx", "title": "", "description": "",
  "type": "task", "severity": "medium", "status": "open", "tags": [],
  "created_at": "", "updated_at": "", "resolved_at": null,
  "comments": [], "attachments": [], "linked_files": [],
  "time_estimate_hours": null, "time_spent_hours": null, "created_by": null,
  "history": [{ "action": "created", "timestamp": "" }]
}
```

---

## Updating an Issue

Always update `updated_at` when writing any change. Only modify the fields being changed.

Editable fields: `title`, `description`, `severity`/`priority`, `tags`, `linked_files`, `time_estimate_hours`, `time_spent_hours`, `roadmap_quarter`, `use_case`, `acceptance_criteria`, `steps_to_reproduce`, `expected_behavior`, `actual_behavior`, `environment`.

---

## Changing Status

1. Note the current `status` as `from`.
2. Set `status` to the new value and update `updated_at`.
3. If new status is `completed` → set `resolved_at` to now. If moving away from `completed` → set `resolved_at` to `null`.
4. Append to `history`: `{ "action": "status_changed", "from": "...", "to": "...", "timestamp": "" }`

---

## Adding a Comment

1. Find the highest `CMT-XXXX` number in `comments` and increment (start at `CMT-0001` if none).
2. Append to `comments`: `{ "id": "CMT-XXXX", "text": "", "created_at": "", "created_by": null }`
3. Append to `history`: `{ "action": "comment_added", "timestamp": "" }`
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
