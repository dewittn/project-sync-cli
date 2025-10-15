# Troubleshooting Guide

This guide helps you diagnose and fix common issues with prjsync.

## Configuration Issues

### "Configuration not found"

**Symptom:** Error when running any command.

**Cause:** Configuration file doesn't exist at `~/.prjsync/config.json`.

**Solution:**

Run the configuration setup:

```bash
deno task start config --set
```

Follow the prompts to enter your NocoDB connection details.

---

### "Invalid configuration"

**Symptom:** Error about missing or invalid configuration values.

**Cause:** Configuration file exists but is incomplete or corrupted.

**Solution:**

1. Check your configuration:

```bash
deno task start config --show
```

2. If it looks wrong, reset and reconfigure:

```bash
deno task start config --reset
deno task start config --set
```

---

### Configuration File Location

Configuration is stored at: `~/.prjsync/config.json`

**View the file:**

```bash
cat ~/.prjsync/config.json
```

**Delete the file:**

```bash
rm ~/.prjsync/config.json
```

## Connection Issues

### "Things app not found"

**Symptom:** Error when trying to access Things projects.

**Cause:** Things 3 is not installed or not running.

**Solutions:**

1. **Install Things 3** from the Mac App Store
2. **Launch Things 3** - It must be running for prjsync to work
3. **Grant permissions** - First time you run prjsync, macOS may ask for
   permission to control Things

**Test the connection:**

```bash
deno task start test
```

---

### "Connection failed to NocoDB"

**Symptom:** HTTP errors when trying to connect to NocoDB.

**Possible Causes:**

1. Incorrect NocoDB URL
2. Invalid or expired API token
3. Wrong table ID
4. Network issues
5. NocoDB server is down

**Solutions:**

**Step 1: Verify your configuration**

```bash
deno task start config --show
```

Check:

- URL format (should be `https://nocodb.example.com`, no trailing slash)
- Table ID format (should be like `t_abcdefgh`)

**Step 2: Test NocoDB connection only**

```bash
deno task start test --nocodb
```

**Step 3: Generate a new API token**

1. Log into NocoDB
2. Go to Profile → Account Settings → Tokens
3. Create a new token
4. Update your configuration:

```bash
deno task start config --set
```

**Step 4: Verify table ID**

1. Open your table in NocoDB
2. Check the URL: `https://nocodb.example.com/nc/p01234567/t_abcdefgh`
3. The table ID is the part starting with `t_` (e.g., `t_abcdefgh`)

**Step 5: Check network connectivity**

```bash
curl -I https://your-nocodb-url.com
```

If this fails, check your network connection or NocoDB server status.

---

### "Permission denied" or "Unauthorized"

**Symptom:** 401 or 403 HTTP errors from NocoDB.

**Cause:** API token doesn't have permission to access the table.

**Solution:**

1. Verify the token has permissions:
   - In NocoDB, check your workspace/base permissions
   - Ensure the token is created in the correct workspace

2. Create a new token with full permissions:
   - User type: Creator or Owner
   - Scope: Full access to the base/workspace

3. Update configuration with the new token:

```bash
deno task start config --set
```

## Sync Issues

### "No matching record found" for Every Project

**Symptom:** Every project prompts for action (create/skip/find).

**Cause:** Field mappings are not configured or incorrect.

**Solution:**

**Step 1: Check field mappings**

```bash
deno task start map --list
```

**Step 2: Verify UUID field mapping**

You must have a mapping for the `id` (UUID) property:

```
id → Things UUID
```

If this is missing, add it:

```bash
deno task start map
```

Choose "Add mapping" and map a NocoDB field to the `id` property.

**Step 3: Test with one project**

```bash
deno task start sync --uuid <project-uuid> --debug
```

This shows the search process and why matches aren't found.

---

### Projects Not Syncing

**Symptom:** Some or all projects don't appear in sync output.

**Cause:** Projects are filtered out by prjsync.

**Excluded project types:**

- Completed projects
- Canceled projects
- Recurring projects (templates)

**Solution:**

1. **Check project status in Things:**
   - Is it in the "Completed" list?
   - Is it marked as recurring/repeating?

2. **List all projects:**

```bash
deno task start list-projects
```

This shows all active projects that prjsync can see.

3. **Use debug mode:**

```bash
deno task start sync --debug
```

This shows all fetched projects and why each one is/isn't synced.

---

### Duplicate Records Created

**Symptom:** Multiple NocoDB records for the same Things project.

**Cause:** UUID field not mapped, so title matching creates duplicates when
titles change.

**Solution:**

1. **Map UUID field immediately:**

```bash
deno task start map
```

Add mapping: `id → <YourUUIDField>`

2. **Clean up duplicates:**
   - Manually delete duplicate records in NocoDB
   - Keep only one record per project
   - Ensure it has the correct UUID

3. **Re-sync:**

```bash
deno task start sync
```

Now prjsync will match by UUID and not create duplicates.

---

### Data Not Updating

**Symptom:** Changes in Things don't appear in NocoDB after sync.

**Possible Causes:**

**Cause 1: Field mapping incorrect**

Check field mappings:

```bash
deno task start map --list
```

Verify the Thing property is mapped to the right NocoDB field.

**Cause 2: NocoDB webhooks/automations**

NocoDB automations or webhooks might be overwriting data after prjsync updates
it.

Check NocoDB base settings → Automations/Webhooks.

**Cause 3: Caching issues**

Refresh your NocoDB table view (Cmd+R or F5).

**Solution:**

Use verbose mode to see exactly what's being sent:

```bash
deno task start sync --verbose --uuid <project-uuid>
```

Check:

- Things data section
- Field mappings section
- HTTP request parameters

---

### Verification Failures

**Symptom:** `--verify` flag reports mismatches.

**Possible Causes:**

**Cause 1: NocoDB automations**

NocoDB automations modify data after prjsync updates it.

**Cause 2: Field type conversions**

NocoDB might format values differently (e.g., trimming whitespace, changing line
breaks).

**Cause 3: Read/write field mismatch**

Reading from a different field than the one being written to.

**Solution:**

1. **Use debug mode to see responses:**

```bash
deno task start sync --debug --uuid <project-uuid>
```

2. **Check NocoDB field types:**
   - UUID field: Single Line Text
   - Title field: Single Line Text
   - Notes field: Long Text
   - Area field: Single Line Text
   - Status field: Single Select

3. **Disable automations temporarily** and test sync again.

## Status Tag Sync Issues

### Status Tags Not Being Created

**Symptom:** Status field updates in NocoDB but tags don't change in Things.

**Solutions:**

**Step 1: Verify status field is mapped**

```bash
deno task start map --list
```

Look for a `status` mapping.

**Step 2: Check verbose output**

```bash
deno task start sync --verbose --uuid <project-uuid>
```

Look for the "Status Tag Sync" section. If missing, status sync is disabled.

**Step 3: Verify Status field type**

In NocoDB:

- Field must be "Single Select"
- Must have defined options (e.g., To Do, In Progress, Done)

**Step 4: Check Things permissions**

macOS might be blocking prjsync from modifying Things tags.

Grant permissions in System Preferences → Security & Privacy → Privacy →
Automation.

---

### Wrong Tags Being Removed

**Symptom:** Non-status tags are being removed from Things.

**Cause:** Tag names match status field options in NocoDB.

**Example:**

- You have a tag "Important" in Things
- Your NocoDB Status field has an option "Important"
- prjsync thinks "Important" is a status tag

**Solution:**

**Option 1: Rename tags in Things**

Rename tags to avoid conflicts (e.g., "High Priority" instead of "Important").

**Option 2: Rename status options in NocoDB**

Use different names for status options that don't conflict with your tags.

**Option 3: Temporarily disable status sync**

```bash
deno task start sync --no-status-sync
```

---

### Case Sensitivity Issues

**Symptom:** Tags not matching correctly despite having same name.

**Cause:** Status option names are case-sensitive.

**Example:**

- NocoDB Status option: "In Progress"
- Things tag: "in progress"
- These don't match!

**Solution:**

Ensure exact case match between:

1. NocoDB Status field options
2. Things project tags

Update one or both to match exactly.

## Performance Issues

### Slow Syncs

**Symptom:** Sync takes a long time to complete.

**Causes & Solutions:**

**Cause 1: Large number of NocoDB records**

Pagination fetches 100 records at a time. If you have thousands of records, this
takes time.

**Solution:** No fix needed - this is expected. Consider archiving old records
in NocoDB.

**Cause 2: Network latency**

Remote NocoDB instances take longer to sync.

**Solution:** Use `--dry-run` to avoid repeated network calls while testing.

**Cause 3: Verbose/Debug mode**

These modes generate significant output.

**Solution:** Only use when needed, not for regular syncs.

---

### "Rate limited" or 429 errors

**Symptom:** HTTP 429 errors from NocoDB.

**Cause:** Too many API requests in a short time.

**Solution:**

1. Reduce sync frequency
2. Contact NocoDB admin to increase rate limits
3. Use `--uuid` to sync specific projects instead of all at once

## Permission Errors

### Deno Permission Errors

**Symptom:** Errors about missing Deno permissions.

**Cause:** Running prjsync with manual `deno run` command without required
permissions.

**Required permissions:**

- `--allow-net` - NocoDB API calls
- `--allow-read` - Read configuration files
- `--allow-write` - Write configuration and debug files
- `--allow-env` - Environment variables (if needed)
- `--allow-run` - Execute AppleScript for Things

**Solution:**

Use the configured tasks:

```bash
deno task start
```

These have all permissions pre-configured in `deno.json`.

If running manually:

```bash
deno run --allow-net --allow-read --allow-write --allow-run --allow-env src/cli/index.ts
```

---

### macOS Permission Prompts

**Symptom:** macOS repeatedly asks for permission to control Things.

**Cause:** Automation permissions not properly granted.

**Solution:**

1. Open System Preferences
2. Security & Privacy → Privacy
3. Select "Automation" from the left panel
4. Find Deno or Terminal
5. Ensure "Things3" is checked

## Debug and Investigation

### Using Debug Mode

When you can't figure out what's wrong, use debug mode:

```bash
deno task start sync --debug
```

Debug mode shows:

- All NocoDB API queries
- Full API responses
- Project matching process
- Field mappings being applied
- HTTP request/response details

**Tip:** Combine with `--uuid` to focus on one project:

```bash
deno task start sync --debug --uuid <project-uuid>
```

---

### Debug Output Files

Debug mode saves NocoDB API responses to:

```
.prjsync-debug/nocodb-records-{timestamp}.json
```

These files contain:

- All NocoDB records fetched
- Full record data
- Timestamps

Use these to investigate data issues offline.

---

### Checking Logs

prjsync doesn't maintain persistent logs, but you can capture output:

```bash
deno task start sync --verbose > sync-output.log 2>&1
```

This saves all output (including errors) to `sync-output.log`.

## Getting More Help

If you're still stuck:

1. **Check the documentation:**
   - [Commands Reference](../reference/commands.md)
   - [Configuration Reference](../reference/configuration.md)
   - [Architecture Explanation](../explanation/architecture.md)

2. **Review debug output** carefully - the answer is often in the details

3. **Test incrementally:**
   - Test with `--dry-run` first
   - Test single projects with `--uuid`
   - Use `--verbose` or `--debug` for details

4. **Verify basics:**
   - Configuration is correct
   - Field mappings are set up
   - Both Things and NocoDB are accessible

5. **Create a minimal test case** to isolate the issue

---

## Quick Diagnostic Commands

Run these to quickly diagnose issues:

```bash
# Test connections
deno task start test

# Check configuration
deno task start config --show

# Check field mappings
deno task start map --list

# List Things projects
deno task start list-projects

# Check sync status
deno task start status --detailed

# Test single project in detail
deno task start sync --uuid <uuid> --debug --dry-run
```
