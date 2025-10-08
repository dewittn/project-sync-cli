# How to Sync Projects

This guide covers different scenarios for syncing Things 3 projects to NocoDB.

## Basic Sync

### Sync All Projects

The simplest way to sync is to run the default command:

```bash
deno task start
```

Or explicitly:

```bash
deno task start sync
```

This will:
1. Fetch all active projects from Things 3
2. Fetch all records from your NocoDB table
3. Match projects to records (by UUID, then by title)
4. Create or update records in NocoDB
5. Sync status tags back to Things (if status mapping is configured)

### Preview Changes Before Syncing

To see what would happen without making actual changes:

```bash
deno task start sync --dry-run
```

This is useful when:
- Testing new field mappings
- Checking which projects will be created vs. updated
- Ensuring no unwanted changes will occur

## Targeted Syncs

### Sync a Single Project

If you want to sync just one specific project, use the `--uuid` flag:

```bash
deno task start sync --uuid ABC123-DEF456
```

**Finding a project's UUID:**

```bash
deno task start list-projects
```

This lists all projects with their UUIDs.

**When to use single project sync:**
- Testing field mappings on one project first
- Re-syncing a project after manual changes in Things
- Debugging sync issues with a specific project

### Sync Without Status Tags

If you want to sync project data but skip the status tag synchronization:

```bash
deno task start sync --no-status-sync
```

**Use cases:**
- You manage tags manually in Things
- You're testing sync without affecting tags
- Status field isn't properly configured yet

## Detailed Output

### Verbose Mode

To see detailed information about what's being synced:

```bash
deno task start sync --verbose
```

Verbose mode shows:
- Things project data for each project
- Which NocoDB record is being updated/created
- All field mappings and their values
- HTTP request details
- Status tag changes
- Success/failure status

**Example output:**

```
Syncing: "Launch New Website"
────────────────────────────────────────────────────────

Things Data:
  Title:        Launch New Website
  UUID:         ABC123-DEF456
  Notes:        Build and deploy the new company website
  Area:         Work

Operation:      Update existing record
NocoDB Record:  ID 42

Field Mappings:
  title        → Project Name    : Launch New Website
  uuid         → Things UUID     : ABC123-DEF456
  notes        → Description     : Build and deploy...
  area         → Category        : Work

Status Tag Sync:
  Current tags: Important, To Do
  NocoDB Status: In Progress
  Removed tag: To Do
  Added tag: In Progress

✓ Successfully updated
```

### Debug Mode

For step-by-step execution with full API details:

```bash
deno task start sync --debug
```

Debug mode:
- Pauses after each project for confirmation
- Shows all API queries and responses
- Displays the two-step search process (UUID → Title)
- Saves NocoDB responses to `.prjsync-debug/` directory
- Shows exactly which fields are being queried

**Use debug mode when:**
- Troubleshooting sync issues
- Understanding how matching works
- Investigating API errors
- Learning how the sync process works

## Verification

### Verify Synced Data

To check that synced data matches between Things and NocoDB:

```bash
deno task start sync --verify
```

After syncing, verification mode:
1. Queries each synced record from NocoDB
2. Compares actual values against expected values
3. Checks that status tags match the NocoDB Status field
4. Reports any mismatches

**Example output:**

```
Verifying synced data...
  ✓ Verified: Launch New Website
  ✓ Verified: Marketing Campaign
  ⚠️  Verification failed for "Mobile App":
     - Field "Description": expected "New iOS app", got "Old description"
     - Status tag mismatch: NocoDB="In Progress" but tag="To Do"

⚠️  Verification: 14 passed, 1 failed
```

**When verification fails:**
- Check your field mappings
- Ensure NocoDB field types are correct
- Use `--debug` to see what's being sent
- Check for NocoDB webhooks or automations that modify data

## Combining Options

You can combine multiple flags for powerful workflows:

### Test Specific Project in Detail

```bash
deno task start sync --uuid ABC123 --verbose --dry-run
```

Shows detailed output for one project without making changes.

### Full Sync with Verification

```bash
deno task start sync --verbose --verify
```

Syncs all projects with detailed output and verifies the results.

### Debug Single Project

```bash
deno task start sync --uuid ABC123 --debug
```

Step through one project's sync with full API details.

### Preview with Details

```bash
deno task start sync --dry-run --verbose
```

See exactly what would be synced without making changes.

## Sync Behavior

### What Gets Synced

**Always synced:**
- Active projects from Things 3
- Projects in any area
- Projects with or without notes

**Never synced:**
- Completed projects
- Canceled projects (if status field is configured)
- Recurring projects (these are templates, not actual projects)

### Project Matching

prjsync uses a two-step process to match Things projects to NocoDB records:

**Step 1: UUID Match**
- Searches for a record with matching UUID in the configured UUID field
- This is the most reliable matching method

**Step 2: Title Fallback**
- If no UUID match is found, searches by project title
- If a match is found, the record is updated with the UUID

**No Match Found**
- You'll be prompted to create a new record, search manually, skip, or debug

### Create vs. Update

- **Update**: When a matching record is found (by UUID or title)
- **Create**: When no matching record exists and you choose to create one

Updates only modify the mapped fields - other fields in NocoDB are left unchanged.

## Performance Tips

### Large Projects

If you have many projects:

1. **Use `--dry-run` first** to check what will happen
2. **Verify field mappings** before syncing hundreds of projects
3. **Use `--verbose` sparingly** (generates a lot of output)
4. **Monitor NocoDB** to ensure it's handling the load

### Frequent Syncs

If you sync frequently:

1. **Skip status sync when not needed** with `--no-status-sync`
2. **Sync specific projects** that changed instead of all projects
3. **Avoid `--verify` every time** (adds extra API calls)

## Troubleshooting

### "No matching record found" for Every Project

Check your field mappings:

```bash
deno task start map --list
```

Ensure the `id` (UUID) field is mapped correctly.

### Projects Not Syncing

Check that:
- Projects are active (not completed or canceled)
- Projects are not recurring
- Field mappings exist for the data you want to sync

Use `--debug` to see why specific projects aren't syncing.

### Status Tags Not Working

See the dedicated [Status Tag Sync Guide](status-sync.md).

### API Errors

If you get NocoDB API errors:
- Check your API token is still valid
- Verify the table ID is correct
- Use `--debug` to see the full error response
- Check NocoDB logs for server-side errors

---

## Related Documentation

- [Status Tag Sync](status-sync.md) - Bidirectional status synchronization
- [Troubleshooting](troubleshooting.md) - Common issues and solutions
- [Commands Reference](../reference/commands.md) - Complete command documentation
- [Operation Modes](../reference/modes.md) - Detailed mode documentation
