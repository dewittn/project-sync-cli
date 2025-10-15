# Sync Strategy

This document explains the design decisions and algorithms behind prjsync's
synchronization logic.

## Sync Philosophy

prjsync follows these principles:

1. **One-way data sync** - Things is the source of truth for project data
2. **Bidirectional status sync** - Status can flow from NocoDB → Things via tags
3. **Non-destructive** - Never delete data, only create or update
4. **Explicit actions** - Prompt user for unclear situations
5. **Idempotent** - Running sync multiple times produces same result

## Sync Direction

### Primary Sync: Things → NocoDB

```
Things Project Data        NocoDB Record
───────────────────       ─────────────
title                 →   Project Name
uuid                  →   Things UUID
notes                 →   Description
area                  →   Category
```

**Rationale:** Things is where projects are created and managed. NocoDB is a
database view of those projects.

**Behavior:**

- Things data always overwrites NocoDB data
- NocoDB fields not mapped are left unchanged
- Users can add extra fields in NocoDB (not synced from Things)

### Secondary Sync: NocoDB → Things (Status Only)

```
NocoDB Status Field   →   Things Tag
────────────────────      ──────────
"In Progress"         →   Add tag: In Progress
"Done"                →   Add tag: Done
```

**Rationale:** Status is often updated in a database view (NocoDB) and should
reflect in the task manager (Things).

**Limitation:** Only status field supports bidirectional sync. Other fields
remain one-way.

## Project Matching Algorithm

### Two-Step Search Process

prjsync uses a two-step process to match Things projects to NocoDB records:

#### Step 1: UUID Match (Primary)

```
For each Things project:
  1. Get project UUID (e.g., "ABC123-DEF456")
  2. Search NocoDB records where UUID field = "ABC123-DEF456"
  3. If match found:
     → Update that record
     → Done
  4. If no match:
     → Proceed to Step 2
```

**Advantages:**

- Reliable (UUIDs are unique)
- Handles project renames
- Fastest search method

**Requirements:**

- UUID field must be mapped in configuration
- UUID field must contain Things UUID values

#### Step 2: Title Match (Fallback)

```
If Step 1 found no match:
  1. Get project title (e.g., "Launch Website")
  2. Search NocoDB records where Title field = "Launch Website"
  3. If match found:
     → Update that record
     → Store UUID for future matches
     → Done
  4. If no match:
     → Prompt user (create/skip/find)
```

**Use Cases:**

- First-time sync (no UUIDs in NocoDB yet)
- Manually created NocoDB records
- Migration from other systems

**Limitations:**

- Requires exact title match (case-sensitive)
- Fails if project was renamed

### Why Two Steps?

**Design Decision:** Prioritize reliability over performance.

**Alternative considered:** Title-only matching

- **Rejected because:** Unreliable when projects are renamed

**Alternative considered:** UUID-only matching

- **Rejected because:** Breaks first-time sync and manual records

**Chosen approach:** UUID first (reliable), title fallback (flexible)

## Record Creation vs. Update

### Decision Logic

```
For each Things project:
  Match found (UUID or title)?
    ├─ Yes: UPDATE existing record
    │   ├─ Preserve record ID
    │   ├─ Preserve unmapped fields
    │   └─ Update mapped fields only
    │
    └─ No: PROMPT user
        ├─ Create new record
        ├─ Find and select existing
        └─ Skip (don't sync)
```

### Update Behavior

**Only mapped fields are updated:**

If field mappings are:

- `title → Project Name`
- `uuid → Things UUID`
- `notes → Description`

Then update only updates:

- `Project Name`
- `Things UUID`
- `Description`

**Other fields untouched:**

- `Priority` (not mapped) → Unchanged
- `Assigned To` (not mapped) → Unchanged
- `Custom Field` (not mapped) → Unchanged

**Benefit:** Users can add extra fields in NocoDB without interference.

### Create Behavior

**All mapped fields are set:**

New record created with:

- All mapped field values
- Other fields set to defaults (empty or NocoDB defaults)

**UUID immediately stored:**

Ensures future syncs will match by UUID (Step 1), not title (Step 2).

## Status Tag Sync

### Overview

Status tag sync is a bidirectional feature that syncs NocoDB Status field values
back to Things as project tags.

### Why Bidirectional Status?

**User workflow:**

1. Create projects in Things
2. View/manage projects in NocoDB (database view)
3. Update status in NocoDB (easier than Things tags)
4. Want status reflected in Things automatically

**Design decision:** Status is metadata that should be kept in sync between
systems.

### Algorithm

```
For each synced project:
  1. Check if status mapping configured
     └─ No: Skip status sync

  2. Check if project should skip status sync
     ├─ Status contains "Completed:" → Skip
     └─ Status = "Canceled" → Skip

  3. Read Status field from NocoDB record
     └─ Store value (e.g., "In Progress")

  4. Get current project tags from Things
     └─ List: ["Important", "Urgent", "To Do"]

  5. Get available status options from NocoDB
     └─ List: ["To Do", "In Progress", "Review", "Done"]

  6. Find status tags in current tags
     └─ Current tags ∩ Status options = ["To Do"]

  7. Remove old status tags
     └─ Remove tag "To Do" from Things

  8. Add new status tag (if status not empty)
     └─ Add tag "In Progress" to Things

  9. Final tags: ["Important", "Urgent", "In Progress"]
```

### Status Tag Identification

**Question:** How does prjsync know which tags are status tags?

**Answer:** Tags that match NocoDB Status field options.

**Example:**

NocoDB Status field (Single Select) has options:

- To Do
- In Progress
- Review
- Done

Things project has tags:

- Important
- Urgent
- To Do
- Client Work

**Status tags identified:**

- To Do (matches status option)

**Non-status tags preserved:**

- Important
- Urgent
- Client Work

### Tag Replacement Logic

**Why replace instead of accumulate?**

**Scenario:** Project status changes from "To Do" → "In Progress" → "Review"

**If we accumulated:**

- After first sync: Tags = [To Do]
- After second sync: Tags = [To Do, In Progress]
- After third sync: Tags = [To Do, In Progress, Review]
- **Problem:** All old statuses remain

**By replacing:**

- After first sync: Tags = [To Do]
- After second sync: Tags = [In Progress]
- After third sync: Tags = [Review]
- **Result:** Only current status is tagged

### Empty Status Handling

**Scenario:** NocoDB Status field is cleared (set to empty)

**Behavior:**

1. No new tag added
2. All status tags removed
3. Non-status tags preserved

**Result:** Project has no status tags

**Use case:** User wants to clear status in both systems

### Case Sensitivity

**Requirement:** Exact match between NocoDB option and Things tag

**Example:**

NocoDB option: "In Progress" Things tag must be: "In Progress"

**Not matched:**

- "in progress" (lowercase)
- "IN PROGRESS" (uppercase)
- "In-Progress" (hyphenated)

**Implementation:** String comparison is case-sensitive

**Rationale:** Consistency and predictability. Users control exact naming.

### Status Tag Creation

**Question:** What if status tag doesn't exist in Things?

**Answer:** prjsync creates it automatically.

**Behavior:**

1. Attempt to add tag "In Progress"
2. If tag doesn't exist, Things creates it
3. Tag is added to project

**Result:** Tags appear in Things tag list automatically

**Benefit:** No manual tag setup required

### Skip Conditions

#### Completed Projects

**Condition:** Status field contains "Completed:"

**Example:** `Completed: 2025-03-15`

**Rationale:**

- Completed projects shouldn't have tags modified
- "Completed" is a special state
- Date indicates when completed

**Behavior:** Status sync skipped entirely

#### Canceled Projects

**Condition:** Status field = "Canceled"

**Rationale:**

- Canceled projects are archived
- Shouldn't be modified

**Behavior:** Status sync skipped entirely

### Performance Considerations

**API Calls per Project:**

For each synced project with status mapping:

1. Read NocoDB record (already fetched during match)
2. Get status field options (cached per sync)
3. Get Things project tags (1 AppleScript call)
4. Remove old tags (1 AppleScript call per tag)
5. Add new tag (1 AppleScript call)

**Optimization:**

- Status options fetched once per sync, cached
- Only AppleScript calls for tag operations

**Trade-off:**

- More API calls per project
- Slower sync overall
- Can be disabled with `--no-status-sync`

### Error Handling

**What if status tag sync fails?**

**Behavior:**

1. Error is logged
2. Project data sync still succeeds
3. Sync continues with next project

**Rationale:**

- Status tags are supplementary feature
- Project data sync is primary goal
- Don't fail entire sync for tag issues

**Example error:**

```
✓ Project data synced
⚠️  Status tag sync failed: Unable to add tag "In Progress"
```

## Pagination Strategy

### NocoDB Pagination

**Challenge:** NocoDB tables can have thousands of records.

**Solution:** Offset-based pagination

```
Batch 1: GET /records?limit=100&offset=0    → Records 1-100
Batch 2: GET /records?limit=100&offset=100  → Records 101-200
Batch 3: GET /records?limit=100&offset=200  → Records 201-300
...
Continue until fewer than 100 records returned
```

**Parameters:**

- `limit=100` - Records per request
- `offset=N` - Skip first N records

**Why 100?**

- Reliable (NocoDB handles well)
- Fast enough (not too many requests)
- Conservative (avoids timeouts)

**Alternative considered:** `limit=1000`

- **Rejected:** Risk of timeouts or memory issues

**Alternative considered:** `limit=10`

- **Rejected:** Too many requests, slower overall

### Handling Large Datasets

**10,000 records:**

- 100 API requests
- ~30 seconds (at 300ms per request)

**50,000 records:**

- 500 API requests
- ~2.5 minutes

**Optimization opportunity:** Parallel requests (not yet implemented)

## Sync Filtering

### Excluded Project Types

#### Completed Projects

**Filter:** Project status = "completed"

**Rationale:**

- Completed projects are archived
- Don't need ongoing sync
- Clutters NocoDB with old data

**Implementation:** Things AppleScript filters completed projects

#### Recurring Projects

**Filter:** Project is template for recurring tasks

**Rationale:**

- Recurring projects are templates, not actual projects
- Individual instances are separate projects

**Implementation:** AppleScript query excludes recurring

#### Canceled Projects (During Status Sync)

**Filter:** NocoDB Status = "Canceled"

**Rationale:**

- Canceled projects shouldn't have tags modified
- But project data can still be synced (one-way)

**Implementation:** Checked during status tag sync step

### Including All Other Projects

**Included:**

- Active projects
- Projects without areas
- Projects without notes
- Projects with or without tags

**Philosophy:** Be inclusive by default

## Error Recovery

### Partial Sync Success

**Scenario:** Sync succeeds for some projects, fails for others

**Behavior:**

1. Continue syncing remaining projects
2. Track successful and failed projects
3. Display summary at end

**Example:**

```
Synced 15 projects:
  ✓ 12 successful
  ❌ 3 failed

Failed projects:
  - Project Alpha (HTTP 500 error)
  - Project Beta (Network timeout)
  - Project Gamma (Invalid field value)
```

**Rationale:**

- Maximize successful syncs
- Don't fail entire batch for individual errors
- User can retry failed projects individually

### Retry Strategy

**Current approach:** No automatic retry

**Rationale:**

- Errors are often configuration issues
- User should investigate and fix root cause
- Automatic retry could mask problems

**Manual retry:**

```bash
# Retry specific project
deno task start sync --uuid ABC123
```

### Rollback

**Question:** Does prjsync support rollback?

**Answer:** No

**Rationale:**

- Sync is meant to be idempotent
- Re-running sync should fix issues
- No transaction support across Things and NocoDB

**Best practice:** Use `--dry-run` before actual sync

## Design Trade-offs

### UUID Storage Requirement

**Decision:** Require UUID field in NocoDB

**Trade-off:**

- ✓ Reliable matching
- ✓ Handles renames
- ✗ Extra field in NocoDB
- ✗ Manual schema setup

**Alternative:** Title-only matching

- ✗ Unreliable with renames
- ✓ No extra field needed

**Chosen:** Reliability over simplicity

### Bidirectional Status Only

**Decision:** Only status is bidirectional, other fields are one-way

**Trade-off:**

- ✓ Simpler logic
- ✓ Clear source of truth (Things)
- ✗ Can't update project data from NocoDB

**Alternative:** Full bidirectional sync

- ✗ Complex conflict resolution
- ✗ Unclear source of truth
- ✓ More flexible

**Chosen:** Simplicity over full bidirectionality

### Interactive Prompts

**Decision:** Prompt user when no match found

**Trade-off:**

- ✓ User control
- ✓ Prevents unwanted records
- ✗ Requires user attention
- ✗ Can't run unattended

**Alternative:** Auto-create records

- ✗ May create duplicates
- ✗ Less control
- ✓ Fully automated

**Chosen:** User control over automation

### Tag-Based Status

**Decision:** Use Things tags for status (not a separate field)

**Trade-off:**

- ✓ Works with Things' architecture
- ✓ Visible in Things UI
- ✗ Mixed with other tags
- ✗ Requires tag management

**Alternative:** Don't sync status back to Things

- ✗ Status only in NocoDB
- ✓ Simpler implementation

**Constraint:** Things has no "status" field, only tags

**Chosen:** Use available mechanism (tags)

## Future Enhancements

### Considered Features

1. **Full bidirectional sync**
   - Sync all fields both ways
   - Conflict resolution logic
   - **Challenge:** Determining source of truth

2. **Automatic sync scheduling**
   - Run sync periodically
   - Webhook integration
   - **Challenge:** Requires background service

3. **Sync only changed projects**
   - Track change timestamps
   - Skip unchanged projects
   - **Challenge:** No change tracking in Things

4. **Parallel NocoDB requests**
   - Fetch multiple pages simultaneously
   - **Benefit:** Faster for large tables

5. **Things tags → NocoDB**
   - Sync all tags to NocoDB field
   - **Challenge:** Tag field type (multi-select vs. text)

## Related Documentation

- [Architecture](architecture.md) - System design
- [Status Tag Sync How-To](../how-to/status-sync.md) - Using status sync
- [Project Structure](project-structure.md) - Codebase organization
