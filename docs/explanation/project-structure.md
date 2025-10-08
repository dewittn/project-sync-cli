# Project Structure

This document explains the codebase organization and file layout of prjsync.

## Directory Overview

```
project-sync-cli/
├── src/                    # Source code
│   ├── api/               # API clients for external systems
│   ├── cli/               # Command-line interface
│   ├── config/            # Configuration management
│   └── utils/             # Shared utilities
├── docs/                   # Documentation (Diátaxis framework)
│   ├── tutorials/         # Learning-oriented guides
│   ├── how-to/            # Task-oriented guides
│   ├── reference/         # Information-oriented docs
│   ├── explanation/       # Understanding-oriented docs
│   └── development.md     # Development guide
├── deno.json              # Deno configuration and tasks
├── deno.lock              # Dependency lock file
├── README.md              # Project overview
└── CLAUDE.md              # AI assistant guidance
```

## Source Code (`src/`)

### API Layer (`src/api/`)

Abstractions for external system APIs.

#### `api/nocodb.ts`

**Purpose:** NocoDB REST API client

**Exports:**
- `NocoDBClient` class

**Key Methods:**
```typescript
class NocoDBClient {
  getRecords(): Promise<Record[]>
  createRecord(data: object): Promise<Record>
  updateRecord(id: number, data: object): Promise<Record>
  getFieldOptions(fieldName: string): Promise<string[]>
  searchRecords(filters: object): Promise<Record[]>
}
```

**Responsibilities:**
- HTTP requests to NocoDB API
- Authentication (xc-token header)
- Pagination handling
- Error parsing and reporting
- Response validation

**Dependencies:**
- Deno's built-in `fetch()`
- Configuration for URL, token, table ID

#### `api/things.ts`

**Purpose:** Things 3 integration via AppleScript

**Exports:**
- `ThingsClient` class

**Key Methods:**
```typescript
class ThingsClient {
  listProjects(): Promise<Project[]>
  getProjectTags(uuid: string): Promise<string[]>
  addTag(uuid: string, tag: string): Promise<void>
  removeTag(uuid: string, tag: string): Promise<void>
}
```

**Responsibilities:**
- Execute AppleScript commands via `osascript`
- Parse AppleScript text output
- Filter completed/recurring projects
- Tag management operations

**Challenges:**
- AppleScript output is unstructured text
- Requires complex parsing
- Limited error information
- Things must be running

### CLI Layer (`src/cli/`)

Command-line interface and user interaction.

#### `cli/index.ts`

**Purpose:** CLI entry point and command routing

**Exports:**
- `main()` function (entry point)

**Responsibilities:**
- Parse command-line arguments
- Route to command handlers
- Global error handling
- Help message display

**Structure:**
```typescript
async function main() {
  const args = parseArgs(Deno.args)

  switch (command) {
    case 'sync':
      await syncCommand(args)
      break
    case 'map':
      await mapCommand(args)
      break
    // ... other commands
  }
}
```

#### `cli/commands/`

Individual command implementations.

**Files:**
- `sync.ts` - Project synchronization
- `map.ts` - Field mapping configuration
- `config.ts` - Configuration management
- `list-projects.ts` - List Things projects
- `status.ts` - Show sync status
- `test.ts` - Test connections

**Pattern:** Each command exports an async function:
```typescript
export async function syncCommand(options: SyncOptions): Promise<void> {
  // Command implementation
}
```

### Configuration Layer (`src/config/`)

Configuration management and persistence.

#### `config/manager.ts`

**Purpose:** Configuration CRUD operations

**Exports:**
- `ConfigManager` class

**Key Methods:**
```typescript
class ConfigManager {
  load(): Promise<Config>
  save(config: Config): Promise<void>
  reset(): Promise<void>
  getFieldMapping(property: string): string | null
  addFieldMapping(nocodbField: string, thingsProperty: string): Promise<void>
}
```

**Responsibilities:**
- Read/write `~/.prjsync/config.json`
- Encrypt/decrypt API tokens
- Manage field mappings
- Track sync statistics

**Configuration Structure:**
```typescript
interface Config {
  nocodbUrl: string
  nocodbToken: string  // encrypted
  tableId: string
  fieldMappings: FieldMapping[]
  syncStats?: SyncStats
}

interface FieldMapping {
  nocodbField: string
  thingsProperty: string
}
```

### Utilities (`src/utils/`)

Shared utilities and helpers.

#### `utils/state.ts`

**Purpose:** Sync state and statistics tracking

**Exports:**
- `SyncState` class

**Responsibilities:**
- Track projects synced in current session
- Count creates/updates/errors
- Generate summary reports

## Configuration Files

### `deno.json`

**Purpose:** Deno project configuration

**Contents:**
- `tasks` - Command shortcuts
- `imports` - Dependency mappings
- `compilerOptions` - TypeScript settings
- `fmt` - Code formatter settings
- `lint` - Linter rules

**Key Tasks:**
```json
{
  "tasks": {
    "start": "deno run ... src/cli/index.ts",
    "dev": "deno run --watch ... src/cli/index.ts",
    "test": "deno test",
    "fmt": "deno fmt",
    "lint": "deno lint"
  }
}
```

**Permissions:**
- `--allow-net` - NocoDB API access
- `--allow-read` - Read config files
- `--allow-write` - Write config/debug files
- `--allow-run` - Execute AppleScript
- `--allow-env` - Environment variables (if needed)

### `deno.lock`

**Purpose:** Lock file for dependencies

**Auto-generated:** Updated when dependencies change

### `.prjsync-debug/` (Generated)

**Purpose:** Debug output directory

**Contents:**
- `nocodb-records-{timestamp}.json` - NocoDB API responses

**Created by:** `--debug` mode

## Documentation (`docs/`)

Organized using the [Diátaxis framework](https://diataxis.fr/).

### `docs/tutorials/`

**Purpose:** Learning-oriented guides for beginners

**Files:**
- `getting-started.md` - First-time setup and sync
- `field-mapping.md` - Field mapping walkthrough

### `docs/how-to/`

**Purpose:** Task-oriented guides for specific goals

**Files:**
- `sync-projects.md` - Different sync scenarios
- `status-sync.md` - Status tag synchronization
- `troubleshooting.md` - Common issues and solutions

### `docs/reference/`

**Purpose:** Information-oriented technical details

**Files:**
- `commands.md` - Complete command reference
- `configuration.md` - Config file structure
- `interactive-prompts.md` - All prompts explained
- `modes.md` - Verbose, Debug, Verification, Dry-run

### `docs/explanation/`

**Purpose:** Understanding-oriented conceptual docs

**Files:**
- `architecture.md` - System design (this file)
- `project-structure.md` - Codebase organization
- `sync-strategy.md` - Sync logic deep dive

### `docs/development.md`

**Purpose:** Development guide for contributors

**Contents:**
- Development setup
- Running tests
- Code quality tools
- Contributing guidelines

## Project Metadata

### `README.md`

**Purpose:** Project overview and quick start

**Sections:**
- Overview and features
- Quick start instructions
- Links to detailed documentation
- License and AI usage

### `CLAUDE.md`

**Purpose:** Guidance for Claude Code (AI assistant)

**Contents:**
- Project overview for AI
- Common commands
- Architecture notes
- Key technical details

**Usage:** Helps AI assistants understand the project context when providing development help.

## File Naming Conventions

### TypeScript Files

**Pattern:** `kebab-case.ts`

**Examples:**
- `nocodb.ts` - Single word, lowercase
- `field-mapping.ts` - Multiple words, hyphenated
- `list-projects.ts` - Command name matches CLI

### Documentation Files

**Pattern:** `kebab-case.md`

**Examples:**
- `getting-started.md` - Tutorial
- `sync-projects.md` - How-to guide
- `commands.md` - Reference

### Configuration Files

**Standard names:**
- `deno.json` - Deno configuration
- `deno.lock` - Dependency lock
- `README.md` - Project readme
- `CLAUDE.md` - AI guidance

## Import Structure

### Import Map (in `deno.json`)

```json
{
  "imports": {
    "@std/cli": "jsr:@std/cli@^1.0.0",
    "@std/fmt": "jsr:@std/fmt@^1.0.0",
    "@cliffy/prompt": "jsr:@cliffy/prompt@^1.0.0"
  }
}
```

### Import Patterns

**API Clients:**
```typescript
import { NocoDBClient } from "../api/nocodb.ts";
import { ThingsClient } from "../api/things.ts";
```

**Configuration:**
```typescript
import { ConfigManager } from "../config/manager.ts";
```

**Utilities:**
```typescript
import { SyncState } from "../utils/state.ts";
```

**Standard Library:**
```typescript
import { parseArgs } from "@std/cli/parse-args";
import { colors } from "@std/fmt/colors";
```

## Code Organization Principles

### 1. Separation of Concerns

Each module has a single, clear responsibility:
- API clients only handle external APIs
- CLI only handles user interaction
- Config only handles configuration

### 2. Dependency Direction

```
CLI Commands
     ↓
Configuration ← → API Clients
     ↓
Utilities
```

**Rules:**
- CLI depends on Config and API
- API never depends on CLI
- Config is independent
- No circular dependencies

### 3. Error Handling

**Pattern:** Errors bubble up to CLI layer

```typescript
// API layer - throw descriptive errors
throw new Error(`NocoDB API error: ${response.statusText}`)

// CLI layer - catch and display
try {
  await syncProjects()
} catch (error) {
  console.error(colors.red(`❌ ${error.message}`))
  Deno.exit(1)
}
```

### 4. Type Safety

**Interfaces defined at usage point:**

```typescript
// In nocodb.ts
export interface NocoDBRecord {
  Id: number
  [key: string]: unknown
}

// In things.ts
export interface ThingsProject {
  title: string
  uuid: string
  notes: string
  area?: string
}
```

### 5. Configuration as Dependency

**Pattern:** Pass configuration to constructors

```typescript
const config = await ConfigManager.load()
const nocodb = new NocoDBClient(
  config.nocodbUrl,
  config.nocodbToken,
  config.tableId
)
```

**Benefit:** Easy testing with mock configuration

## Testing Structure

### Test Files

**Pattern:** `{module}_test.ts`

**Examples:**
- `nocodb_test.ts`
- `things_test.ts`
- `config_test.ts`

### Test Organization

```typescript
import { assertEquals } from "@std/assert";

Deno.test("NocoDBClient - getRecords", async () => {
  // Test implementation
});

Deno.test("NocoDBClient - createRecord", async () => {
  // Test implementation
});
```

### Running Tests

```bash
# All tests
deno task test

# Specific file
deno test src/api/nocodb_test.ts

# Watch mode
deno test --watch
```

## Build and Distribution

### Development Mode

```bash
deno task dev
```

Uses `--watch` flag to auto-restart on file changes.

### Production Build

```bash
deno task compile
```

Creates standalone executable:
- `dist/prjsync` (macOS/Linux)
- `dist/prjsync.exe` (Windows)

### Installation

```bash
deno task install
```

Installs compiled executable to `/usr/local/bin/`

## Adding New Features

### Adding a New Command

1. **Create command file:**
   ```
   src/cli/commands/new-command.ts
   ```

2. **Implement command:**
   ```typescript
   export async function newCommand(options: Options) {
     // Implementation
   }
   ```

3. **Add route in index.ts:**
   ```typescript
   case 'new-command':
     await newCommand(args);
     break;
   ```

4. **Add task in deno.json** (optional):
   ```json
   "new-command": "deno task start new-command"
   ```

5. **Document:**
   - Add to `docs/reference/commands.md`
   - Update `README.md` if major feature

### Adding a New API Method

1. **Add method to client:**
   ```typescript
   // In nocodb.ts or things.ts
   async newMethod(params: Params): Promise<Result> {
     // Implementation
   }
   ```

2. **Add tests:**
   ```typescript
   // In nocodb_test.ts or things_test.ts
   Deno.test("Client - newMethod", async () => {
     // Test
   });
   ```

3. **Use in commands:**
   ```typescript
   // In command file
   const result = await client.newMethod(params);
   ```

## Related Documentation

- [Architecture](architecture.md) - System design
- [Sync Strategy](sync-strategy.md) - Sync algorithm
- [Development Guide](../development.md) - Building and testing
