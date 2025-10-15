# How to Use Status Tag Sync

This guide shows you how to set up and use bidirectional status synchronization
between NocoDB and Things 3.

## What is Status Tag Sync?

Status tag sync keeps your project statuses in sync between NocoDB and Things:

- NocoDB Status field values → Things project tags
- When you update a Status in NocoDB, the corresponding tag is added/updated in
  Things
- Old status tags are automatically removed and replaced with the current status

## Quick Setup

### 1. Ensure You Have a Status Field in NocoDB

Your NocoDB table needs a Single Select field for status. For example:

- **Field name**: Status
- **Field type**: Single Select
- **Options**: To Do, In Progress, Review, Done, On Hold

### 2. Map the Status Field

Run the field mapping command:

```bash
deno task start map
```

Choose option `1` (Add mapping), then:

1. Select your Status field
2. Map it to the `status` property

Example:

```
Select field to map: Status
Select property: status

✓ Mapped: status → Status
✓ Status sync enabled
```

### 3. Sync Your Projects

Now when you sync, status tags will automatically be managed:

```bash
deno task start sync
```

That's it! Status synchronization is now active.

## How It Works

### During Each Sync

For each project that's synced:

1. **Project data syncs** from Things → NocoDB (title, UUID, notes, area)
2. **Status value reads** from the just-updated NocoDB record
3. **Status tag syncs** back to Things as a tag
4. **Old status tags removed** (tags matching any status option)
5. **New status tag added** (if a status value exists)

### Example

**Before sync:**

- NocoDB Status: `To Do`
- Things tags: `Important`, `To Do`

**After updating in NocoDB:**

- NocoDB Status: `In Progress`

**After sync:**

- NocoDB Status: `In Progress` (unchanged)
- Things tags: `Important`, `In Progress`

Notice:

- `To Do` tag was removed
- `In Progress` tag was added
- `Important` tag was preserved (it's not a status tag)

## Common Workflows

### Workflow 1: Update Status in NocoDB

1. Change a project's Status field in NocoDB (e.g., from "To Do" to "In
   Progress")
2. Run `deno task start sync`
3. Check Things - the project now has an "In Progress" tag

### Workflow 2: New Projects from Things

1. Create a new project in Things
2. Run `deno task start sync`
3. A new record is created in NocoDB (Status will be empty or default)
4. If Status has a value, the tag is added to Things immediately

### Workflow 3: Bulk Status Updates

1. Update multiple project statuses in NocoDB
2. Run `deno task start sync`
3. All corresponding Things projects get their tags updated

### Workflow 4: Clear a Status

1. Clear the Status field in NocoDB (set to empty)
2. Run `deno task start sync`
3. All status tags are removed from Things (non-status tags remain)

## Status Tags vs. Non-Status Tags

### Status Tags

Status tags are tags that match any of the Single Select options in your NocoDB
Status field.

If your Status field has options:

- To Do
- In Progress
- Review
- Done

Then these are considered status tags when they appear in Things:

- ✓ To Do
- ✓ In Progress
- ✓ Review
- ✓ Done

### Non-Status Tags

Any other tags are preserved and never modified:

- Important
- Urgent
- Personal
- Client Work
- etc.

prjsync only touches tags that match status options.

## Seeing Status Sync in Action

### Use Verbose Mode

To see detailed status tag changes:

```bash
deno task start sync --verbose
```

For each project, you'll see:

```
Status Tag Sync:
  Current tags: Important, To Do, Urgent
  NocoDB Status: In Progress
  Status tags found: To Do
  Removed tag: To Do
  Added tag: In Progress
  Final tags: Important, Urgent, In Progress
```

### Use Verification Mode

To verify that status tags match NocoDB Status field:

```bash
deno task start sync --verify
```

If there's a mismatch, you'll see:

```
⚠️  Verification failed for "My Project":
   - Status tag mismatch: NocoDB Status="In Progress" but Things has tag="To Do"
```

## Projects That Skip Status Sync

Status tag sync is automatically skipped for:

### 1. Completed Projects

Projects with Status containing "Completed:" are skipped.

Example: `Completed: 2025-03-15`

**Why?** Completed projects shouldn't have their tags modified.

### 2. Canceled Projects

Projects with Status = "Canceled" are skipped.

**Why?** Canceled projects are archived and shouldn't be modified.

### 3. Projects Without Status Mapping

If you haven't mapped a status field, status sync is disabled for all projects.

## Disabling Status Sync

### Temporarily Disable

Use the `--no-status-sync` flag:

```bash
deno task start sync --no-status-sync
```

This syncs project data but skips all status tag changes.

### Permanently Disable

Remove the status field mapping:

1. Edit `~/.prjsync/config.json`
2. Remove the mapping with `"thingsProperty": "status"` from `fieldMappings`
3. Save the file

Status sync will be disabled until you map a status field again.

## Troubleshooting

### Status Tags Not Being Created

**Check that the Status field is mapped:**

```bash
deno task start map --list
```

You should see a `status` mapping.

**Verify your Status field has options:**

In NocoDB, check that your Status field is a Single Select with defined options.

### Wrong Tags Being Removed

**Issue:** Non-status tags are being removed.

**Cause:** Your non-status tags match status field options.

**Solution:** Rename tags in Things or status options in NocoDB to avoid
conflicts.

### Tags Not Updating

**Check with verbose mode:**

```bash
deno task start sync --verbose --uuid <project-uuid>
```

Look for the "Status Tag Sync" section to see what's happening.

**Common causes:**

- Status field not mapped
- Status field is empty in NocoDB
- Project is completed or canceled
- Things app doesn't have permission to modify tags

### Status Field Not Reading Correctly

**Check the field type in NocoDB:**

- Must be a Single Select field
- Not Multi Select, Text, or any other type

**Check the field name matches your mapping:**

Use `--debug` mode to see which field is being read:

```bash
deno task start sync --debug --uuid <project-uuid>
```

### Case Sensitivity Issues

Status field options are case-sensitive:

- "In Progress" ≠ "in progress"
- "To Do" ≠ "to do"

Make sure:

- NocoDB option: `In Progress`
- Things tag: `In Progress`
- Both must match exactly (including capitalization and spaces)

## Best Practices

### 1. Use Standard Status Names

Choose clear, consistent status names:

- ✓ To Do, In Progress, Review, Done
- ✗ ToDo, InProgress, review, DONE

### 2. Keep Status Options Short

Short status names work better as tags:

- ✓ In Progress
- ✗ Currently Being Worked On By The Team

### 3. Limit Status Options

Too many status options create tag clutter:

- ✓ 4-6 status options
- ✗ 15+ status options

### 4. Don't Manually Edit Status Tags

Let prjsync manage status tags automatically. Manually adding/removing status
tags in Things will be overwritten on the next sync.

Non-status tags can be edited freely.

### 5. Sync Regularly

Run syncs regularly to keep status tags up to date:

- After updating statuses in NocoDB
- Before important reviews or meetings
- Daily or weekly as part of your workflow

## Advanced: Status Tag Sync Logic

For a detailed explanation of how status tag sync works under the hood, see:

[Sync Strategy Deep Dive](../explanation/sync-strategy.md#status-tag-sync)

---

## Related Documentation

- [Sync Projects](sync-projects.md) - General sync workflows
- [Field Mapping Tutorial](../tutorials/field-mapping.md) - Setting up field
  mappings
- [Sync Strategy Explanation](../explanation/sync-strategy.md) - How the sync
  process works
- [Troubleshooting](troubleshooting.md) - Common issues
