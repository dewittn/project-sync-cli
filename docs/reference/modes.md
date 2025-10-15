# Operation Modes Reference

Complete reference for prjsync operation modes: Verbose, Debug, Verification,
and Dry-run.

## Overview

prjsync supports four special operation modes that provide different levels of
detail and control during sync operations.

| Mode             | Flag              | Purpose                          | Output Level          |
| ---------------- | ----------------- | -------------------------------- | --------------------- |
| **Dry-run**      | `--dry-run`       | Preview changes without applying | Normal                |
| **Verbose**      | `--verbose`, `-v` | Detailed sync information        | High                  |
| **Debug**        | `--debug`         | Step-by-step with API details    | Very High             |
| **Verification** | `--verify`        | Validate synced data             | Normal + Verification |

**Modes can be combined:**

```bash
deno task start sync --verbose --dry-run
deno task start sync --debug --verify
```

---

## Dry-Run Mode

### Flag

```bash
--dry-run
```

### Purpose

Preview what would happen during a sync without making any actual changes.

### What It Does

- ✓ Fetches Things projects
- ✓ Fetches NocoDB records
- ✓ Performs matching logic
- ✓ Shows what would be created/updated
- ✗ Does NOT create or update records
- ✗ Does NOT modify Things tags

### When to Use

- **Before first sync** - Preview results
- **After configuration changes** - Verify new settings
- **Testing field mappings** - Ensure data maps correctly
- **Large syncs** - Preview before syncing many projects
- **Uncertain changes** - When you want to see impact first

### Example Usage

```bash
# Basic dry-run
deno task start sync --dry-run

# Dry-run with verbose output
deno task start sync --dry-run --verbose

# Dry-run for specific project
deno task start sync --uuid ABC123 --dry-run
```

### Example Output

```
Dry-run mode: No changes will be made

Fetching NocoDB records...
Found 42 records in NocoDB

Fetching Things projects...
Found 15 projects in Things

Syncing projects (dry-run)...
✓ Project Alpha (would update record ID: 12)
✓ Project Beta (would update record ID: 34)
✓ Project Gamma (would create new record)
⊘ Project Delta (skipped - completed)

Dry-run summary:
  15 projects processed
  12 would be updated
  3 would be created
  0 errors

No changes were made (dry-run mode)
```

### Limitations

**Accurate for:**

- Which projects will be synced
- Whether records will be created or updated
- Basic matching logic

**Not accurate for:**

- Actual NocoDB field validations
- Server-side constraints
- NocoDB automations that trigger on changes

**Recommendation:** For critical syncs, run dry-run first, then run actual sync
and monitor results.

---

## Verbose Mode

### Flag

```bash
--verbose
-v
```

### Purpose

Show detailed information about each project being synced.

### What It Shows

For each project:

1. **Things project data** - All property values
2. **Operation type** - Create new or update existing
3. **NocoDB record ID** - For updates
4. **Field mappings** - Each mapping and its value
5. **HTTP request details** - Method, URL, parameters
6. **NocoDB response** - Full response data
7. **Status tag sync** - Tag changes (if applicable)
8. **Result** - Success or error

### When to Use

- **Troubleshooting** - Understand what's being synced
- **Verifying mappings** - See exact field values
- **Monitoring syncs** - Watch sync progress in detail
- **Learning** - Understand how prjsync works

### Example Usage

```bash
# Verbose sync
deno task start sync --verbose

# Verbose dry-run
deno task start sync --verbose --dry-run

# Verbose single project
deno task start sync --uuid ABC123 --verbose
```

### Example Output

```
Syncing: "Launch New Website"
────────────────────────────────────────────────────────

Things Data:
  Title:        Launch New Website
  UUID:         ABC123-DEF456-GHI789
  Notes:        Build and deploy the new company website with...
  Area:         Work

Operation:      Update existing record
NocoDB Record:  ID 42

Field Mappings:
  title        → Project Name    : Launch New Website
  uuid         → Things UUID     : ABC123-DEF456-GHI789
  notes        → Description     : Build and deploy the new company...
  area         → Category        : Work
  status       → Status          : In Progress

HTTP Request:
  Method:       PATCH
  URL:          https://nocodb.example.com/api/v2/tables/t_abc/records
  Parameters:
    [
      {
        "Id": 42,
        "Project Name": "Launch New Website",
        "Things UUID": "ABC123-DEF456-GHI789",
        "Description": "Build and deploy the new company website with...",
        "Category": "Work",
        "Status": "In Progress"
      }
    ]

NocoDB Response:
  {
    "Id": 42,
    "Project Name": "Launch New Website",
    "Things UUID": "ABC123-DEF456-GHI789",
    "Description": "Build and deploy the new company website with...",
    "Category": "Work",
    "Status": "In Progress",
    "CreatedAt": "2025-01-15T10:00:00Z",
    "UpdatedAt": "2025-03-15T10:30:45Z"
  }

Status Tag Sync:
  Current tags: Important, To Do, Urgent
  NocoDB Status: In Progress
  Status tags found: To Do
  Removed tag: To Do
  Added tag: In Progress
  Final tags: Important, Urgent, In Progress

✓ Successfully updated

════════════════════════════════════════════════════════
```

### Performance Impact

Verbose mode generates significant output:

- **Many projects** (100+) → Large amount of text
- **Slow terminals** → May appear to hang while rendering
- **Log files** → Large files if redirected

**Recommendation:** Use verbose mode for targeted debugging with `--uuid`, not
for regular syncs of many projects.

---

## Debug Mode

### Flag

```bash
--debug
```

### Purpose

Step-by-step sync execution with full API details and confirmation prompts.

### What It Shows

Everything in Verbose mode, plus:

1. **NocoDB API queries** - Exact query parameters
2. **Pagination details** - Batches of records fetched
3. **All NocoDB records** - Complete list
4. **Record files** - Saves responses to `.prjsync-debug/`
5. **Search process** - Two-step UUID → Title search
6. **Field checks** - Which NocoDB fields are searched
7. **Match results** - Why matches were/weren't found
8. **Confirmation prompts** - After each project

### When to Use

- **Deep troubleshooting** - Understand sync failures
- **Matching issues** - Why projects aren't matching
- **API errors** - Investigate NocoDB errors
- **Learning internals** - See how prjsync works

### Example Usage

```bash
# Debug mode
deno task start sync --debug

# Debug specific project
deno task start sync --uuid ABC123 --debug

# Debug without making changes
deno task start sync --debug --dry-run
```

### Example Output

```
Debug mode enabled
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fetching NocoDB records...

API Query Parameters:
  URL: https://nocodb.example.com/api/v2/tables/t_abc/records
  Method: GET
  Query: ?limit=100&offset=0

Fetching batch 1 (records 0-100)...
✓ Fetched 100 records

Fetching batch 2 (records 100-200)...
✓ Fetched 50 records

Total records fetched: 150

Saving NocoDB records to: .prjsync-debug/nocodb-records-2025-03-15-103045.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Processing project: "Launch New Website"

Things Project Data:
  Title:  Launch New Website
  UUID:   ABC123-DEF456-GHI789
  Area:   Work
  Notes:  Build and deploy the new company website...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Searching for matching NocoDB record...

Step 1: UUID Search
  Field: Things UUID
  Value: ABC123-DEF456-GHI789
  Equivalent SQL: WHERE `Things UUID` = 'ABC123-DEF456-GHI789'

  Searching through 150 records...
  ✓ Match found! Record ID: 42

Match Details:
  NocoDB Record:
    Id: 42
    Project Name: Launch New Website (OLD)
    Things UUID: ABC123-DEF456-GHI789
    Description: Old description...
    Category: Work
    Status: To Do

  Will update fields:
    Project Name: "Launch New Website (OLD)" → "Launch New Website"
    Description: "Old description..." → "Build and deploy..."
    Status: "To Do" → "In Progress"

HTTP Request to Update:
  Method: PATCH
  URL: https://nocodb.example.com/api/v2/tables/t_abc/records
  Headers:
    xc-token: ********
    Content-Type: application/json
  Body:
    [{"Id":42,"Project Name":"Launch New Website",...}]

Sending request...

HTTP Response:
  Status: 200 OK
  Body:
    {"Id":42,"Project Name":"Launch New Website",...}

✓ Update successful

Status Tag Sync:
  Reading Status from NocoDB record...
  Status value: "In Progress"
  Current Things tags: ["Important", "To Do", "Urgent"]

  Finding status tags to remove...
  Available status options: ["To Do", "In Progress", "Review", "Done"]
  Status tags found in Things: ["To Do"]

  Removing old status tags...
  ✓ Removed tag: To Do

  Adding new status tag...
  ✓ Added tag: In Progress

  Final tags: ["Important", "Urgent", "In Progress"]

✓ Project synced successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Continue to next project? [y/n]:
```

### Debug Files

Debug mode saves NocoDB responses to:

```
.prjsync-debug/nocodb-records-{timestamp}.json
```

**Example:**

```
.prjsync-debug/nocodb-records-2025-03-15-103045.json
```

**Contents:**

- All NocoDB records fetched
- Complete record data
- Useful for offline analysis

### Performance Impact

Debug mode is **significantly slower**:

- Prompts after each project
- Extensive output generation
- File I/O for debug files

**Recommendation:** Use only for troubleshooting specific issues, never for
regular syncs.

---

## Verification Mode

### Flag

```bash
--verify
```

### Purpose

Validate that synced data in NocoDB matches what was sent from Things.

### What It Does

After sync completes:

1. **Re-queries** each synced record from NocoDB
2. **Compares** fetched values against expected values
3. **Checks status tags** against NocoDB Status field
4. **Reports mismatches** with field details

### When to Use

- **After configuration changes** - Ensure mappings work correctly
- **Testing NocoDB setup** - Verify field types and constraints
- **Troubleshooting data issues** - Find discrepancies
- **Quality assurance** - Ensure sync accuracy

### Example Usage

```bash
# Sync with verification
deno task start sync --verify

# Verify with verbose output
deno task start sync --verbose --verify

# Verify specific project
deno task start sync --uuid ABC123 --verify
```

### Example Output

```
Syncing projects...
✓ Project Alpha (updated)
✓ Project Beta (updated)
✓ Project Gamma (created)

Synced 3 projects

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verifying synced data...

Verifying: Project Alpha
  ✓ Field "Project Name" matches
  ✓ Field "Things UUID" matches
  ✓ Field "Description" matches
  ✓ Field "Category" matches
  ✓ Field "Status" matches
  ✓ Status tag matches NocoDB Status

Verifying: Project Beta
  ✓ All fields match
  ✓ Status tag matches

Verifying: Project Gamma
  ⚠️  Field "Description" mismatch:
     Expected: "Build new mobile application for iOS and Android"
     Got:      "Build new mobile application for iOS and..."
  ⚠️  Status tag mismatch:
     NocoDB Status: "In Progress"
     Things tag:    "To Do"
  ✓ Other fields match

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verification Results:
  ✓ 2 projects verified successfully
  ⚠️  1 project with mismatches

⚠️  Some verifications failed. Check output above for details.
```

### What Causes Verification Failures

**Common causes:**

1. **NocoDB automations** - Modify data after prjsync updates it
2. **Field constraints** - NocoDB truncates or formats values
3. **Field type conversions** - Data transformed during storage
4. **Timing issues** - Status tags not yet applied when verification runs
5. **Character limits** - Long text fields truncated
6. **Whitespace** - Leading/trailing spaces added or removed

### Handling Verification Failures

**For field mismatches:**

1. Check NocoDB field types
2. Look for automations or webhooks
3. Increase field length limits if truncated
4. Use `--debug` to see exact values sent

**For status tag mismatches:**

1. Check that status field is mapped correctly
2. Verify status options in NocoDB match tag names exactly
3. Allow more time between sync and verification
4. Use `--verbose` to see status tag operations

### Performance Impact

Verification adds extra API calls:

- One API call per synced project
- Doubles network traffic for the sync
- Increases sync time

**Recommendation:** Use verification periodically for quality checks, not for
every sync.

---

## Combining Modes

### Useful Combinations

#### Preview with Details

```bash
deno task start sync --dry-run --verbose
```

See exactly what would be synced without making changes.

#### Safe Verification

```bash
deno task start sync --dry-run --verify
```

Note: Verification has no effect in dry-run mode (nothing to verify).

#### Deep Debugging

```bash
deno task start sync --debug --verbose
```

Maximum detail (verbose is implied in debug, so this is redundant).

#### Test Single Project

```bash
deno task start sync --uuid ABC123 --verbose --verify
```

Sync one project with details and verification.

#### Safe Testing

```bash
deno task start sync --uuid ABC123 --dry-run --verbose
```

Preview one project in detail without changes.

### Invalid Combinations

#### Verify with Dry-run

```bash
deno task start sync --dry-run --verify
```

Verification has no effect (nothing was actually synced to verify).

---

## Quick Reference

| Mode        | Use For             | Output           | Speed    | Use Regularly?       |
| ----------- | ------------------- | ---------------- | -------- | -------------------- |
| **Normal**  | Regular syncs       | Minimal          | Fast     | ✓ Yes                |
| **Dry-run** | Preview changes     | Normal           | Fast     | ✓ Before big changes |
| **Verbose** | Understand syncs    | High             | Moderate | Sometimes            |
| **Debug**   | Troubleshoot issues | Very High        | Slow     | Rarely               |
| **Verify**  | Check accuracy      | Normal + Reports | Slow     | Occasionally         |

---

## Related Documentation

- [Commands Reference](commands.md) - All command flags
- [Sync Projects Guide](../how-to/sync-projects.md) - Sync workflows
- [Troubleshooting](../how-to/troubleshooting.md) - Common issues
- [Sync Strategy](../explanation/sync-strategy.md) - How sync works
