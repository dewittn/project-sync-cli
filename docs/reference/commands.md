# Commands Reference

Complete reference for all prjsync CLI commands and their options.

## Command Syntax

```bash
deno task start [command] [options]
```

If no command is specified, `sync` is executed by default.

## Global Options

These options can be used with any command:

| Option       | Description                       |
| ------------ | --------------------------------- |
| `-h, --help` | Show help message for the command |

---

## `sync` (Default Command)

Synchronize Things 3 projects to NocoDB.

### Usage

```bash
deno task start sync [options]
deno task start [options]  # sync is default
```

### Options

| Option             | Type   | Description                                      |
| ------------------ | ------ | ------------------------------------------------ |
| `-v, --verbose`    | Flag   | Show detailed sync information for each project  |
| `--dry-run`        | Flag   | Preview changes without applying them            |
| `--debug`          | Flag   | Step-by-step sync with full API details          |
| `--verify`         | Flag   | Verify data accuracy after syncing each record   |
| `--uuid <uuid>`    | String | Sync only one specific project by UUID           |
| `--no-status-sync` | Flag   | Disable bidirectional status tag synchronization |
| `-h, --help`       | Flag   | Show help message                                |

### Behavior

**Projects Included:**

- Active projects from Things 3
- Projects in any area
- Projects with or without notes

**Projects Excluded:**

- Completed projects
- Canceled projects (when status field is configured)
- Recurring projects (these are templates)

**Sync Process:**

1. Fetch all NocoDB records (with pagination)
2. Fetch all Things projects
3. For each project:
   - Search for matching record by UUID
   - Fall back to title matching if no UUID match
   - Create new record or update existing record
   - Sync status tag back to Things (if status mapping configured)

**Interactive Prompts:**

When no matching record is found, you'll be prompted:

- `c` - Create new record
- `f` - Find and select existing record (fuzzy search)
- `s` - Skip all remaining projects
- `d` - Show debug information
- `n` - Skip this project (default)

### Examples

```bash
# Sync all projects
deno task start

# Preview sync without making changes
deno task start sync --dry-run

# Sync with detailed output
deno task start sync --verbose

# Sync one specific project
deno task start sync --uuid ABC123-DEF456

# Sync and verify results
deno task start sync --verify

# Debug one project
deno task start sync --uuid ABC123 --debug

# Sync without modifying tags
deno task start sync --no-status-sync

# Combine multiple options
deno task start sync --verbose --verify --dry-run
```

### Exit Codes

| Code | Meaning             |
| ---- | ------------------- |
| 0    | Success             |
| 1    | Configuration error |
| 2    | Connection error    |
| 3    | Sync error          |

---

## `map`

Configure field mappings between Things properties and NocoDB fields.

### Usage

```bash
deno task start map [options]
```

### Options

| Option            | Type   | Description                                                     |
| ----------------- | ------ | --------------------------------------------------------------- |
| `--list`          | Flag   | Display visual field mapping diagram                            |
| `--add <mapping>` | String | Add a specific mapping (format: "NocoDB Field:things_property") |
| `--auto`          | Flag   | Auto-detect and create mappings for common field names          |
| `-h, --help`      | Flag   | Show help message                                               |

### Interactive Mode

When run without options, `map` starts an interactive menu:

**Menu Options:**

1. **Add mapping** - Manually map a NocoDB field to a Things property
2. **View mappings** - See a visual diagram of current mappings
3. **Auto-map** - Automatically detect and create common mappings
4. **Exit** - Save and exit

### Things Properties

| Property | Description                      | Example Value                     |
| -------- | -------------------------------- | --------------------------------- |
| `title`  | Project title/name               | "Launch New Website"              |
| `id`     | Project UUID (unique identifier) | "ABC123-DEF456"                   |
| `notes`  | Project notes/description        | "Build and deploy..."             |
| `area`   | Project area (optional)          | "Work", "Personal"                |
| `status` | For bidirectional status sync    | _(mapped to NocoDB Status field)_ |

### Mapping Syntax

When using `--add`, the format is:

```
"NocoDB Field Name:things_property"
```

**Important:** Field names are case-sensitive.

### Examples

```bash
# Interactive mapping menu
deno task start map

# View current mappings
deno task start map --list

# Auto-detect common mappings
deno task start map --auto

# Add specific mappings
deno task start map --add "Project Name:title"
deno task start map --add "Things UUID:id"
deno task start map --add "Description:notes"
deno task start map --add "Category:area"
deno task start map --add "Status:status"

# Chain multiple add commands
deno task start map --add "Project Name:title" --add "Things UUID:id"
```

### Visual Diagram Example

When using `--list` or viewing in interactive mode:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                     FIELD MAPPING DIAGRAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Things Project          NocoDB Record
┌──────────────┐      ┌──────────────┐
│ • title      │ ────>│ Project Name │
│ • id (UUID)  │ ────>│ Things UUID  │
│ • notes      │ ────>│ Description  │
│ • area       │ ────>│ Category     │
│ • status     │<────>│ Status       │  ✓ Status sync enabled
└──────────────┘      └──────────────┘

Total mappings: 5
Status sync: Enabled
```

---

## `config`

Manage NocoDB connection configuration.

### Usage

```bash
deno task start config [options]
```

### Options

| Option       | Type | Description                                   |
| ------------ | ---- | --------------------------------------------- |
| `--set`      | Flag | Interactive configuration setup               |
| `--show`     | Flag | Display current configuration (tokens hidden) |
| `--reset`    | Flag | Delete all configuration                      |
| `-h, --help` | Flag | Show help message                             |

### Interactive Setup (`--set`)

Prompts for:

1. **NocoDB API URL**
   - Format: `https://nocodb.example.com`
   - No trailing slash or path components

2. **NocoDB API Token**
   - Generated in NocoDB: Profile → Account Settings → Tokens
   - Stored securely in configuration

3. **Table ID**
   - Found in NocoDB URL when viewing table
   - Format: `t_abcdefgh`

### Configuration File

Configuration is stored at: `~/.prjsync/config.json`

**Structure:**

```json
{
  "nocodbUrl": "https://nocodb.example.com",
  "nocodbToken": "encrypted_token",
  "tableId": "t_abcdefgh",
  "fieldMappings": [
    {
      "nocodbField": "Project Name",
      "thingsProperty": "title"
    }
  ]
}
```

### Examples

```bash
# Interactive setup
deno task start config --set

# View configuration
deno task start config --show

# Reset (delete) configuration
deno task start config --reset

# Reset and reconfigure
deno task start config --reset && deno task start config --set
```

### Security

- API tokens are stored with basic encryption
- `--show` masks sensitive values with `****`
- Configuration file has user-only read permissions

---

## `list-projects`

List all Things 3 projects with their UUIDs and details.

### Usage

```bash
deno task start list-projects
```

### Options

| Option       | Type | Description       |
| ------------ | ---- | ----------------- |
| `-h, --help` | Flag | Show help message |

### Output

Shows for each project:

- Project title
- UUID (for use with `--uuid` flag)
- Area (if assigned)
- Notes preview (first line)

### Example Output

```
Active Things Projects:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Launch New Website
  UUID: ABC123-DEF456-GHI789
  Area: Work
  Notes: Build and deploy the new company website

Marketing Campaign
  UUID: XYZ789-UVW456-RST123
  Area: Marketing
  Notes: Q1 marketing campaign planning and execution

Total: 2 projects
```

### Use Cases

- Finding UUIDs for targeted sync (`--uuid` flag)
- Verifying which projects prjsync can see
- Debugging sync issues
- Quick overview of active projects

---

## `status`

Show sync status and statistics.

### Usage

```bash
deno task start status [options]
```

### Options

| Option       | Type | Description                                       |
| ------------ | ---- | ------------------------------------------------- |
| `--detailed` | Flag | Include connection tests and detailed information |
| `-h, --help` | Flag | Show help message                                 |

### Output

**Basic status:**

- Last sync timestamp
- Total syncs performed
- Projects synced in last sync
- Configuration status

**Detailed status (with `--detailed`):**

- All of the above
- NocoDB connection test result
- Things connection test result
- Configuration details
- Field mappings summary

### Examples

```bash
# Basic status
deno task start status

# Detailed status with connection tests
deno task start status --detailed
```

### Example Output

```
Sync Status:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Last sync: 2025-03-15 10:30:45
Total syncs: 42
Last sync results:
  - 15 projects synced
  - 12 updated, 3 created
  - 0 errors

Configuration: ✓ Set
Field mappings: ✓ Configured (5 mappings)

---

Detailed Information:

NocoDB Connection: ✓ Connected
  URL: https://nocodb.example.com
  Table: t_abcdefgh

Things Connection: ✓ Connected
  Projects found: 15

Field Mappings:
  title → Project Name
  id → Things UUID
  notes → Description
  area → Category
  status → Status (bidirectional sync enabled)
```

---

## `test`

Test connections to NocoDB and Things.

### Usage

```bash
deno task start test [options]
```

### Options

| Option       | Type | Description                 |
| ------------ | ---- | --------------------------- |
| `--nocodb`   | Flag | Test only NocoDB connection |
| `-h, --help` | Flag | Show help message           |

### Tests Performed

**Without `--nocodb` (default):**

1. **NocoDB Connection Test**
   - Validates URL and token
   - Attempts to fetch table metadata
   - Reports success or error details

2. **Things Connection Test**
   - Verifies Things 3 is running
   - Attempts to list projects
   - Reports success or error details

**With `--nocodb`:**

- Only tests NocoDB connection
- Useful for debugging NocoDB-specific issues

### Examples

```bash
# Test both connections
deno task start test

# Test only NocoDB
deno task start test --nocodb
```

### Example Output

```
Testing Connections:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NocoDB Connection:
  URL: https://nocodb.example.com
  Table ID: t_abcdefgh

  Testing connection...
  ✓ Connected successfully
  ✓ Table accessible
  ✓ Found 42 records

Things Connection:
  Testing connection...
  ✓ Things 3 is running
  ✓ Found 15 active projects

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All tests passed ✓
```

### Troubleshooting

If tests fail, see:

- [Troubleshooting Guide](../how-to/troubleshooting.md)
- Error messages for specific solutions

---

## Common Flag Combinations

### Safe Testing

```bash
deno task start sync --dry-run --verbose
```

Preview detailed sync without making changes.

### Targeted Debugging

```bash
deno task start sync --uuid ABC123 --debug
```

Debug one specific project with full details.

### Full Sync with Verification

```bash
deno task start sync --verbose --verify
```

Sync with details and verify results.

### Quick Single Project Update

```bash
deno task start sync --uuid ABC123 --no-status-sync
```

Sync one project without modifying tags.

---

## Related Documentation

- [Operation Modes](modes.md) - Detailed mode documentation
- [Interactive Prompts](interactive-prompts.md) - All prompts explained
- [How-To: Sync Projects](../how-to/sync-projects.md) - Sync workflows
- [Troubleshooting](../how-to/troubleshooting.md) - Common issues
