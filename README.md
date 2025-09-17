# NocoDB-Things Sync CLI

A Deno-based CLI tool to synchronize data between NocoDB and the Things macOS
app.

## Features

- **Bidirectional sync** between NocoDB tables and Things tasks
- **Flexible field mapping** to match your NocoDB schema
- **Conflict resolution** for handling simultaneous edits
- **Multiple sync modes**: push, pull, or bidirectional sync
- **Dry-run mode** to preview changes before applying
- **Comprehensive logging** and status tracking

## Installation

Ensure you have Deno installed:

```bash
brew install deno
```

Clone this repository:

```bash
git clone <repository-url>
cd project-sync-cli
```

## Configuration

First, configure your NocoDB connection:

```bash
deno task start config --set
```

You'll be prompted for:

- NocoDB API URL
- NocoDB API token
- Table ID to sync
- Sync direction preference

## Usage

### Basic Commands

```bash
# Run a sync
deno task start sync

# Full re-sync (ignore timestamps)
deno task start sync --full

# Dry run to preview changes
deno task start sync --dry-run

# Push only to NocoDB
deno task start sync --direction push

# Pull only from NocoDB
deno task start sync --direction pull
```

### Configuration Management

```bash
# Interactive configuration
deno task start config --set

# View current configuration
deno task start config --show

# Reset configuration
deno task start config --reset
```

### Field Mapping

```bash
# Interactive field mapping setup
deno task start map

# List current mappings
deno task start map --list

# Add a specific mapping
deno task start map --add "priority:tags"

# Auto-generate mappings
deno task start map --auto
```

### Testing & Status

```bash
# Test all connections
deno task start test

# Test only NocoDB
deno task start test --nocodb

# Check sync status
deno task start status

# Detailed status with connection tests
deno task start status --detailed
```

## Field Mappings

The tool supports mapping between NocoDB fields and Things properties:

### Things Properties

- `title` - Task title
- `notes` - Task description
- `when` - When to do (today, tomorrow, etc.)
- `deadline` - Hard deadline date
- `tags` - Task tags
- `checklist-items` - Checklist items
- `completed` - Completion status
- `project` - Project assignment
- `area` - Area assignment

### Default Mappings

- `title` → `title`
- `notes/description` → `notes`
- `completed/status` → `completed`
- `due_date` → `when`

## Development

```bash
# Run in development mode with watch
deno task dev

# Run tests
deno task test

# Format code
deno task fmt

# Lint code
deno task lint
```

## Requirements

- macOS (for Things app integration)
- Things 3 installed
- NocoDB instance with API access
- Deno runtime

## License

MIT
