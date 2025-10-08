# prjsync

A powerful CLI tool that synchronizes projects between Things 3 (macOS task manager) and NocoDB (database platform), enabling seamless project management across both platforms.

## Overview

prjsync bridges the gap between Things 3 and NocoDB by providing intelligent, bidirectional synchronization of project data. The tool performs one-way sync from Things to NocoDB for project details (title, notes, UUID, area), while also supporting bidirectional status synchronization through tags. This allows you to manage your projects in Things 3 while maintaining a structured database in NocoDB, or update project statuses in NocoDB and have them automatically reflected as tags in Things 3.

Key capabilities include:
- **Smart project matching** using UUID-first lookup with title-based fallback
- **Flexible field mapping** to adapt to any NocoDB schema
- **Bidirectional status sync** that maps NocoDB status values to Things tags
- **Interactive record selection** with fuzzy search for manual linking
- **Comprehensive verification** to ensure data integrity after sync
- **Multiple operation modes** including dry-run, verbose, and debug modes

## Why I Built This

*[Add your personal motivation and context here. For example: Why did you need to sync Things 3 with NocoDB? What problem were you trying to solve? What's your workflow like?]*

## Features

### Core Synchronization
- **One-way data sync**: Things 3 projects → NocoDB records (title, UUID, notes, area)
- **Bidirectional status sync**: NocoDB Status field ↔ Things project tags (NEW)
- **UUID tracking**: Reliable project identification across syncs
- **Smart matching**: Two-step search (UUID first, then title fallback)
- **Field mapping system**: Configure flexible mappings between Things properties and NocoDB fields

### Status Tag Sync (NEW)
- Automatically syncs NocoDB Status field values to Things as tags
- Removes outdated status tags and replaces with current status
- Preserves non-status tags (e.g., "Important", "Urgent")
- Skips completed and canceled projects
- Creates status tags in Things automatically if they don't exist
- Can be disabled with `--no-status-sync` flag

### Interactive Features
- **Record selection**: Fuzzy search through NocoDB records to manually link projects
- **Debug mode**: Step-by-step sync with detailed API information
- **Verification mode**: Validate synced data against expected values
- **Single project sync**: Target specific projects by UUID

### Safety & Control
- **Dry-run mode**: Preview all changes before applying
- **Verbose output**: See detailed sync information for each project
- **Error handling**: Comprehensive error messages with HTTP details
- **Project filtering**: Automatically excludes completed and recurring projects

## Requirements

- **macOS**: Required for Things 3 app integration via AppleScript
- **Things 3**: Installed and running on your Mac
- **NocoDB instance**: Access to a NocoDB server with API enabled
- **Deno runtime**: Version 1.x or higher

## Installation

### Install Deno

```bash
brew install deno
```

### Clone the repository

```bash
git clone <repository-url>
cd project-sync-cli
```

### Verify installation

```bash
deno task start test
```

This will test both NocoDB and Things 3 connections.

## Configuration

### Initial Setup

Configure your NocoDB connection interactively:

```bash
deno task start config --set
```

You'll be prompted for:
- **NocoDB API URL**: Your NocoDB instance URL (e.g., `https://nocodb.example.com`)
- **NocoDB API Token**: API token from your NocoDB account settings
- **Table ID**: The ID of the table to sync projects to
- **Sync direction preference**: (Currently one-way: Things → NocoDB)

### Field Mapping

Map Things project properties to your NocoDB fields:

```bash
deno task start map
```

This interactive command allows you to:
1. **Add mappings**: Link NocoDB fields to Things properties
2. **View mappings**: See a visual diagram of current mappings
3. **Auto-map**: Automatically detect and map common field names
4. **Map Status field**: Enable bidirectional status sync by mapping your Status field

#### Things Project Properties

- `title` - Project title/name
- `id` - Project UUID (unique identifier)
- `notes` - Project notes/description
- `area` - Project area (optional)
- `status` - *Special mapping for bidirectional status sync*

#### Example Field Mapping

```
Things Project          NocoDB Record
┌──────────────┐      ┌──────────────┐
│ • title      │ ────>│ Project Name │
│ • id (UUID)  │ ────>│ Things UUID  │
│ • notes      │ ────>│ Goal         │
│ • area       │ ────>│ Area         │
│ • status     │<────>│ Status       │  (bidirectional)
└──────────────┘      └──────────────┘
```

### Configuration Management

```bash
# View current configuration
deno task start config --show

# Reset configuration (start fresh)
deno task start config --reset
```

Configuration files are stored in `~/.prjsync/config.json`.

## Usage

### Basic Commands

```bash
# Sync all projects (default command)
deno task start

# Explicitly run sync command
deno task start sync

# Preview changes without applying (dry-run)
deno task start sync --dry-run

# Sync with detailed output
deno task start sync --verbose
```

### Status Tag Sync

When you map a Status field using `prjsync map`, the tool automatically enables bidirectional status synchronization:

**How it works:**
1. Projects are synced from Things → NocoDB (title, UUID, notes, area)
2. After each project sync, the Status field value is read from NocoDB
3. The status value is synced back to Things as a tag
4. Old status tags are removed, new status tag is added
5. Non-status tags are preserved

**Example behavior:**

```
NocoDB Status         Things Tags
─────────────────    ───────────────────────
"In Progress"   →    [In Progress]
"On Hold"       →    [On Hold]
"Review"        →    [Review]
(empty)         →    (all status tags removed)

# Non-status tags like "Important" or "Urgent" remain untouched
```

**When status sync is skipped:**
- Projects with Status containing "Completed:" (e.g., "Completed: 2025-03-15")
- Projects with Status = "Canceled"

**Disable status sync:**

```bash
deno task start sync --no-status-sync
```

### Advanced Sync Options

```bash
# Sync one specific project by UUID
deno task start sync --uuid ABC123-DEF456

# Verify data accuracy after sync
deno task start sync --verify

# Enable debug mode (step-by-step with API details)
deno task start sync --debug

# Combine multiple flags
deno task start sync --verbose --verify --uuid ABC123
```

### Listing Projects

```bash
# List all Things projects with UUIDs
deno task start list-projects

# Use this to find UUIDs for targeted sync
```

### Status & Testing

```bash
# Check sync status and statistics
deno task start status

# Check status with detailed connection tests
deno task start status --detailed

# Test connections
deno task start test

# Test only NocoDB connection
deno task start test --nocodb
```

## Command Reference

### `sync` (default command)

Synchronize Things projects to NocoDB.

**Flags:**
- `-v, --verbose` - Show detailed sync information for each project
- `--dry-run` - Preview changes without applying them
- `--debug` - Step-by-step sync with API request/response details
- `--verify` - Verify data accuracy after syncing each record
- `--uuid <uuid>` - Sync only one specific project by UUID
- `--no-status-sync` - Disable bidirectional status tag synchronization
- `-h, --help` - Show help message

**Behavior:**
- Excludes completed projects (syncs only active projects)
- Excludes recurring projects
- Fetches all NocoDB records using pagination (100 records per request)
- Matches projects by UUID first, then by title as fallback
- Prompts for action when no match is found (create/skip/search/debug)

### `map`

Configure field mappings between Things properties and NocoDB fields.

**Flags:**
- `--list` - Display visual field mapping diagram
- `--add <mapping>` - Add a specific mapping (format: "NocoDB Field:things_property")
- `--auto` - Auto-detect and create mappings for common field names

**Example:**
```bash
deno task start map --add "Status:status"
```

### `config`

Manage NocoDB connection configuration.

**Flags:**
- `--set` - Interactive configuration setup
- `--show` - Display current configuration (sensitive values hidden)
- `--reset` - Delete all configuration

### `list-projects`

List all Things projects with their UUIDs and details.

### `status`

Show sync status and statistics.

**Flags:**
- `--detailed` - Include connection tests and detailed information

### `test`

Test connections to NocoDB and Things.

**Flags:**
- `--nocodb` - Test only NocoDB connection

## Interactive Prompts

### No Matching Record Found

When a Things project has no matching NocoDB record, you'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No matching record found for project: "My Project"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Things Project Details:
  Title:  My Project
  UUID:   ABC123-DEF456
  Area:   Work
  Notes:  Project description here...

Options: [c]Create new / [f]Find & select / [s]Skip all / [d]Debug / [n]Skip this:
```

**Options:**
- **`c` (Create)**: Create a new NocoDB record for this project
- **`f` (Find)**: Search and select an existing record to link (uses fuzzy search)
- **`s` (Skip all)**: Stop syncing and skip all remaining projects
- **`d` (Debug)**: Show debug information, then prompt again
- **`n` (Skip this)**: Skip only this project, continue with others (default)

### Find & Select Mode

When you choose `f` to find and select a record:

1. Type to search through all NocoDB records with fuzzy matching
2. See real-time filtered results as you type
3. Use arrow keys to navigate through matching records
4. Press Enter to select and link a record to the project
5. The selected record will be updated with the project's UUID and data

## Verbose Mode

Use `--verbose` to see detailed sync information:

```
Syncing: "My Project"
────────────────────────────────────────────────────────

Things Data:
  Title:        My Project
  UUID:         ABC123-DEF456
  Notes:        This is the project description...
  Area:         Work

Operation:      Update existing record
NocoDB Record:  ID 42

Field Mappings:
  title        → Project Name    : My Project
  uuid         → Things UUID     : ABC123-DEF456
  notes        → Goal            : This is the project description...
  area         → Area            : Work

HTTP Request:
  Method:       PATCH
  URL:          https://nocodb.example.com/api/v2/tables/m123/records
  Parameters:
    [
      {
        "Id": 42,
        "Project Name": "My Project",
        "Things UUID": "ABC123-DEF456",
        "Goal": "This is the project description...",
        "Area": "Work"
      }
    ]

NocoDB Response:
  {
    "Id": 42,
    "Project Name": "My Project",
    ...
  }

  Status Tag Sync:
    Current tags: Important, Old Status
    NocoDB Status: In Progress
    Status tags found: Old Status
    Removed tag: Old Status
    Added tag: In Progress

✓ Successfully updated
```

## Debug Mode

Use `--debug` for step-by-step sync with detailed API information:

- Shows NocoDB API query parameters
- Displays pagination progress (batches of 100 records)
- Lists all NocoDB records found
- Saves full NocoDB response to `.prjsync-debug/nocodb-records-{timestamp}.json`
- Shows Things project data before sync
- Displays two-step search process (UUID → Title)
- Shows which NocoDB fields are being checked
- Displays equivalent NocoDB query clauses
- Shows matched records or reasons for no match
- Displays data being sent to NocoDB
- Shows full HTTP response from NocoDB
- Prompts for confirmation before continuing to next project

## Verification Mode

Use `--verify` to validate synced data:

After all projects are synced, each synced record is:
1. Queried from NocoDB to fetch current values
2. Compared against expected values
3. Status tags verified against NocoDB Status field
4. Mismatches reported with field names and values

```
Verifying synced data...
  ✓ Verified: My Project
  ⚠️  Verification failed for "Another Project":
     - Field "Goal": expected "New description", got "Old description"
     - Status tag mismatch: NocoDB Status="In Progress" but Things has tag="On Hold"

⚠️  Verification: 15 passed, 1 failed
```

## Project Structure

```
project-sync-cli/
├── src/
│   ├── api/           # API clients
│   │   ├── nocodb.ts  # NocoDB REST API client
│   │   └── things.ts  # Things AppleScript integration
│   ├── cli/           # CLI commands
│   │   ├── commands/  # Individual command implementations
│   │   └── index.ts   # CLI entry point
│   ├── config/        # Configuration management
│   │   └── manager.ts # Config storage and retrieval
│   └── utils/         # Utility functions
│       └── state.ts   # Sync state tracking
├── deno.json          # Deno configuration and tasks
└── README.md          # This file
```

## Development

### Run in Development Mode

```bash
deno task dev
```

This runs the CLI with file watching enabled, automatically restarting on changes.

### Running Tests

```bash
deno task test
```

### Code Quality

```bash
# Format code
deno task fmt

# Lint code
deno task lint
```

### Deno Permissions

The CLI requires the following permissions:
- `--allow-net` - Network access for NocoDB API calls
- `--allow-read` - Read configuration files from `~/.prjsync/`
- `--allow-write` - Write configuration and debug files
- `--allow-env` - Access environment variables (if needed)
- `--allow-run` - Execute AppleScript commands for Things integration

## Architecture

### API Layer

**NocoDB Client** (`src/api/nocodb.ts`)
- REST API integration using fetch
- Token-based authentication
- CRUD operations on table records
- Pagination support for large datasets
- Retrieves field metadata (e.g., status options)
- Comprehensive error handling with detailed HTTP information

**Things Client** (`src/api/things.ts`)
- AppleScript-based integration (no official API exists)
- Project listing and property extraction
- Tag management (add, remove, list)
- Filters out completed and recurring projects
- Parses complex AppleScript output formats

### CLI Layer

Command-line interface built with Deno's standard library:
- Argument parsing using `@std/cli/parse-args`
- Colorful output with `@std/fmt/colors`
- Interactive prompts using `@cliffy/prompt`
- Help messages and usage documentation

### Configuration System

Persistent configuration management:
- Stored in `~/.prjsync/config.json`
- Encrypted sensitive values (API tokens)
- Field mapping storage
- Sync statistics and history tracking

## Troubleshooting

### "Configuration not found"

Run the configuration setup:
```bash
deno task start config --set
```

### "Things app not found"

Ensure Things 3 is installed and running on your Mac.

### "No matching record found" for every project

Your NocoDB table may not have the correct field mappings. Run:
```bash
deno task start map
```

### Status tags not syncing

1. Ensure you have mapped a Status field using `prjsync map`
2. Verify the Status field is a Select field in NocoDB with defined options
3. Check that `--no-status-sync` flag is not being used
4. Use `--verbose` to see detailed status sync information

### Permission errors

If you encounter permission errors, ensure all required Deno permissions are granted. The CLI needs `--allow-net`, `--allow-read`, `--allow-write`, `--allow-env`, and `--allow-run`.

### Debug and investigate issues

Use debug mode to see exactly what's happening:
```bash
deno task start sync --debug
```

This will show all API requests, responses, and step through each project individually.

## AI Usage

This project was developed with significant assistance from Claude (Anthropic's AI assistant). AI was used for:

- **Initial project architecture and scaffolding**: Setting up the Deno TypeScript project structure with proper modularity
- **API integration code**: Implementing the NocoDB REST API client and Things AppleScript integration
- **CLI command implementations**: Building interactive commands with proper argument parsing and error handling
- **Status tag sync feature**: Designing and implementing bidirectional status synchronization logic
- **Error handling and debugging features**: Adding comprehensive error messages, debug mode, and verification capabilities
- **Documentation**: Creating this README and inline code documentation
- **Code refinements**: Iterative improvements based on testing and user feedback

The core logic, architecture decisions, and feature requirements were guided by development needs, with Claude providing implementation assistance and code generation.

## License

MIT
