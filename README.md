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
- **Bidirectional status sync**: NocoDB Status field ↔ Things project tags
- **UUID tracking**: Reliable project identification across syncs
- **Smart matching**: Two-step search (UUID first, then title fallback)
- **Field mapping system**: Configure flexible mappings between Things properties and NocoDB fields

### Status Tag Sync
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

## Quick Start

### Installation

**1. Install Deno:**
```bash
brew install deno
```

**2. Clone the repository:**
```bash
git clone <repository-url>
cd project-sync-cli
```

### Run Your First Sync

```bash
deno task start
```

This will guide you through:
1. NocoDB connection setup (URL, API token, table ID)
2. Field mapping configuration
3. Your first project sync

**For detailed setup instructions, see [Getting Started Guide](docs/tutorials/getting-started.md).**

## Command Reference

### `sync` - Sync projects (default command)

```bash
deno task start sync
```

**Common options:**
- `--dry-run` - Preview changes without applying
- `--verbose` - Show detailed output
- `--verify` - Verify synced data
- `--uuid <uuid>` - Sync specific project
- `--no-status-sync` - Skip status tag sync

### `map` - Configure field mappings

```bash
deno task start map
```

Map Things properties (title, id, notes, area, status) to your NocoDB fields.

### `config` - Manage configuration

```bash
deno task start config --set    # Setup NocoDB connection
deno task start config --show   # View configuration
```

### `list-projects` - List Things projects

```bash
deno task start list-projects
```

Shows all projects with UUIDs for targeted sync.

### `status` - Show sync status

```bash
deno task start status
deno task start status --detailed
```

### `test` - Test connections

```bash
deno task start test
```

**For complete command documentation, see [Commands Reference](docs/reference/commands.md).**

## Documentation

Comprehensive documentation is organized using the [Diátaxis framework](https://diataxis.fr/) for easy navigation.

**📚 [Full Documentation](docs/README.md)**

### Quick Links

- **New to prjsync?** [Getting Started Tutorial](docs/tutorials/getting-started.md)
- **Need to do something specific?** [How-To Guides](docs/how-to/)
- **Looking for command details?** [Commands Reference](docs/reference/commands.md)
- **Want to understand how it works?** [Architecture Explanation](docs/explanation/architecture.md)
- **Contributing to the project?** [Development Guide](docs/development.md)

### Documentation Categories

#### Tutorials (Learning)
- [Getting Started](docs/tutorials/getting-started.md) - First-time setup and sync
- [Field Mapping](docs/tutorials/field-mapping.md) - Interactive mapping walkthrough

#### How-To Guides (Tasks)
- [Sync Projects](docs/how-to/sync-projects.md) - Different sync scenarios
- [Status Tag Sync](docs/how-to/status-sync.md) - Bidirectional status setup
- [Troubleshooting](docs/how-to/troubleshooting.md) - Common issues

#### Reference (Information)
- [Commands](docs/reference/commands.md) - Complete command reference
- [Configuration](docs/reference/configuration.md) - Config file structure
- [Interactive Prompts](docs/reference/interactive-prompts.md) - All prompts explained
- [Operation Modes](docs/reference/modes.md) - Verbose, Debug, Verification, Dry-run

#### Explanation (Understanding)
- [Architecture](docs/explanation/architecture.md) - System design
- [Project Structure](docs/explanation/project-structure.md) - Codebase organization
- [Sync Strategy](docs/explanation/sync-strategy.md) - How sync works

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
