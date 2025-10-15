# Getting Started with prjsync

This tutorial will guide you through installing prjsync and performing your
first successful sync between Things 3 and NocoDB.

## Prerequisites

Before you begin, make sure you have:

1. **macOS** - Required for Things 3 integration via AppleScript
2. **Things 3** - Installed and running on your Mac with at least one active
   project
3. **NocoDB instance** - A NocoDB server with:
   - Access to the API
   - An existing table to sync projects to
   - An API token (from your NocoDB account settings)
4. **Deno runtime** - Version 1.x or higher

## Step 1: Install Deno

If you don't have Deno installed, install it using Homebrew:

```bash
brew install deno
```

Verify the installation:

```bash
deno --version
```

## Step 2: Clone the Repository

Clone the prjsync repository and navigate to the project directory:

```bash
git clone <repository-url>
cd project-sync-cli
```

## Step 3: Verify Installation

Test that prjsync can connect to both Things 3 and NocoDB:

```bash
deno task start test
```

This command will:

- Test if Things 3 is accessible via AppleScript
- Attempt to connect to NocoDB (will prompt for configuration if not set up)

If you see errors about missing configuration, that's expected! We'll set that
up in the next step.

## Step 4: Configure NocoDB Connection

Run the interactive configuration setup:

```bash
deno task start config --set
```

You'll be prompted for the following information:

1. **NocoDB API URL**: The URL of your NocoDB instance
   - Example: `https://nocodb.example.com`
   - Don't include `/api/v2` or any path components

2. **NocoDB API Token**: Your API token from NocoDB
   - Find this in NocoDB: Profile → Account Settings → Tokens → Create Token
   - Copy and paste the token when prompted

3. **Table ID**: The ID of the table you want to sync projects to
   - Find this in the NocoDB URL when viewing your table
   - Example: If the URL is
     `https://nocodb.example.com/nc/p01234567/t_abcdefgh`, the table ID is
     `t_abcdefgh`

The configuration is saved to `~/.prjsync/config.json`.

### 🔒 Security Note

**Important:** Your NocoDB API token is stored in plain text in
`~/.prjsync/config.json`. To protect your credentials:

```bash
# Set restrictive permissions on the config file
chmod 600 ~/.prjsync/config.json

# Protect the entire directory
chmod 700 ~/.prjsync
```

Never commit this file to version control or share it with others. See the
[Configuration Security Guide](../reference/configuration.md#security-considerations)
for detailed security recommendations.

## Step 5: Verify Configuration

Check that your configuration was saved correctly:

```bash
deno task start config --show
```

You should see your NocoDB URL and table ID (the API token is hidden for
security).

## Step 6: Set Up Field Mapping

Before you can sync projects, you need to map Things project properties to your
NocoDB table fields.

Start the interactive field mapping:

```bash
deno task start map
```

### Understanding Field Mapping

Things projects have these properties:

- `title` - Project name
- `id` - Unique identifier (UUID)
- `notes` - Project description
- `area` - Project area (optional)
- `status` - For bidirectional status sync (optional)

You need to map each of these to fields in your NocoDB table.

### Mapping Options

When you run `prjsync map`, you'll see these options:

1. **Add mapping** - Manually map a NocoDB field to a Things property
2. **View mappings** - See a visual diagram of your current mappings
3. **Auto-map** - Automatically detect and create common mappings
4. **Exit** - Save and exit

### Quick Setup with Auto-Map

The easiest way to get started is to use auto-mapping:

1. Choose option `3` (Auto-map)
2. prjsync will scan your NocoDB table and automatically create mappings for
   fields with common names
3. Review the suggested mappings
4. Add any missing mappings manually

### Manual Mapping

To manually add a mapping:

1. Choose option `1` (Add mapping)
2. Select or type the NocoDB field name
3. Select the Things property to map it to
4. Repeat until all required properties are mapped

### Required Mappings

At minimum, you should map:

- `title` - So project names sync correctly
- `id` - So prjsync can track which projects are already synced

Optional but recommended:

- `notes` - To sync project descriptions
- `area` - To sync project areas
- `status` - For bidirectional status synchronization

## Step 7: Your First Sync (Dry-Run)

Before actually syncing, let's preview what will happen:

```bash
deno task start sync --dry-run
```

This will:

- Fetch all your Things projects
- Fetch all NocoDB records
- Show what would be created or updated
- **Not make any actual changes**

Review the output to ensure everything looks correct.

## Step 8: Perform the Sync

If the dry-run looks good, perform the actual sync:

```bash
deno task start
```

Or explicitly:

```bash
deno task start sync
```

You'll see output showing the progress:

```
Fetching NocoDB records...
Found 42 records in NocoDB

Fetching Things projects...
Found 15 projects in Things

Syncing projects...
✓ Project Alpha (updated)
✓ Project Beta (updated)
✓ Project Gamma (created)
...

Successfully synced 15 projects (12 updated, 3 created)
```

## Step 9: Verify the Sync

Check your NocoDB table - you should see your Things projects there with all
their data!

You can also use the built-in verification mode:

```bash
deno task start sync --verify
```

This will sync your projects and then verify that the data in NocoDB matches
what's in Things.

## What's Next?

Congratulations! You've successfully set up and performed your first sync.
Here's what to explore next:

- **[Field Mapping Tutorial](field-mapping.md)** - Learn advanced field mapping
  techniques
- **[Sync Projects Guide](../how-to/sync-projects.md)** - Explore different sync
  scenarios and options
- **[Status Tag Sync](../how-to/status-sync.md)** - Set up bidirectional status
  synchronization
- **[Commands Reference](../reference/commands.md)** - Explore all available
  commands and options

## Common First-Time Issues

### "No matching record found" for Every Project

This usually means your field mappings aren't quite right. Make sure you've
mapped the `id` (UUID) field correctly. Run `prjsync map` again and verify your
mappings.

### Things App Not Found

Ensure Things 3 is installed and running. prjsync uses AppleScript to
communicate with Things, which requires the app to be open.

### Connection Failed to NocoDB

Double-check your:

- NocoDB URL (no trailing slash)
- API token (create a new one if unsure)
- Table ID (from the NocoDB URL)

Run `deno task start test --nocodb` to test just the NocoDB connection.

### Permission Errors

prjsync needs several Deno permissions to work. These are configured in
`deno.json`, but if you run commands manually, ensure you include:

- `--allow-net` - For NocoDB API calls
- `--allow-read` - For reading configuration
- `--allow-write` - For saving configuration
- `--allow-run` - For AppleScript commands

---

Need more help? See the [Troubleshooting Guide](../how-to/troubleshooting.md)
for common issues and solutions.
