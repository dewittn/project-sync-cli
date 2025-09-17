# NocoDB-Things Project Sync

A Deno-based CLI tool to synchronize projects from Things 3 (macOS task manager)
to NocoDB (database platform).

## Features

- **One-way sync** from Things projects to NocoDB records
- **Automatic UUID tracking** for project identification
- **Flexible field mapping** to match your NocoDB schema
- **Visual mapping diagram** for easy understanding
- **Dry-run mode** to preview changes before applying
- **Project listing** to view all Things projects

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
# Sync projects (default command)
deno task start

# Explicitly sync projects
deno task start sync

# List all Things projects
deno task start list-projects

# Dry run to preview changes
deno task start sync --dry-run
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
# Interactive project field mapping setup
deno task start map

# View visual field mapping diagram
deno task start map --list

# Add a specific mapping
deno task start map --add "Goal:notes"

# Auto-generate project mappings
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

The tool maps Things project properties to NocoDB fields:

### Things Project Properties

- `title` - Project title
- `id` - Project unique identifier (UUID)
- `notes` - Project notes/goals
- `area` - Project area

### Default NocoDB Field Mappings

```
  Things Project          NocoDB Record
  ┌──────────────┐      ┌──────────────┐
  │ • title      │ ────>│ Title        │
  │              │      │ Project Name │
  │ • id (UUID)  │ ────>│ Things UUID  │
  │ • notes      │ ────>│ Goal         │
  │ • area       │ ────>│ Area         │
  └──────────────┘      └──────────────┘
```

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
