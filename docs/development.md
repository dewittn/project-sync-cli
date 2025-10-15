# Development Guide

This guide covers development setup, testing, code quality, and contributing to
prjsync.

## Prerequisites

### Required

- **Deno** - Version 1.x or higher
  ```bash
  brew install deno
  ```

- **macOS** - Required for Things 3 integration
- **Things 3** - Installed and running for testing

### Recommended

- **VS Code** with Deno extension
- **Git** for version control

## Getting Started

### Clone Repository

```bash
git clone <repository-url>
cd project-sync-cli
```

### Verify Installation

```bash
# Check Deno version
deno --version

# Run development mode
deno task dev
```

## Development Tasks

All tasks are defined in `deno.json`.

### Run Development Server

```bash
deno task dev
```

**Features:**

- Auto-restart on file changes (`--watch`)
- All permissions enabled
- Faster development cycle

### Run CLI

```bash
# Run with default command
deno task start

# Run specific command
deno task start sync --dry-run
deno task start map
deno task start config --show
```

### Run Tests

```bash
# All tests
deno task test

# Watch mode
deno task test --watch

# Specific test file
deno test src/api/nocodb_test.ts

# With coverage
deno test --coverage=coverage/
deno coverage coverage/
```

### Code Formatting

```bash
# Check formatting
deno task fmt --check

# Auto-format all files
deno task fmt
```

**Configuration:** `deno.json` → `fmt` section

**Rules:**

- 2 spaces indentation
- Line width: 80 characters
- Single quotes for strings
- Semicolons required

### Linting

```bash
# Check all files
deno task lint

# Specific file
deno lint src/api/nocodb.ts
```

**Configuration:** `deno.json` → `lint` section

**Custom rules:**

- No unused variables
- No unreachable code
- Consistent return types

### Type Checking

```bash
# Check types without running
deno task check

# Or
deno check src/cli/index.ts
```

Catches TypeScript errors without execution.

## Project Structure

See [Project Structure](explanation/project-structure.md) for detailed code
organization.

### Quick Overview

```
src/
├── api/           # API clients (NocoDB, Things)
├── cli/           # CLI commands and interface
├── config/        # Configuration management
└── utils/         # Shared utilities

docs/              # Documentation (Diátaxis)
tests/             # Test files (*_test.ts)
```

## Writing Code

### Code Style

Follow these conventions:

**File Naming:**

```
kebab-case.ts     # Module files
kebab-case_test.ts # Test files
```

**Function Naming:**

```typescript
// Use camelCase for functions
async function syncProjects() {}
function parseArgs() {}

// Use PascalCase for classes
class NocoDBClient {}
class ConfigManager {}
```

**Import Order:**

```typescript
// 1. Standard library
import { parseArgs } from "@std/cli/parse-args";

// 2. Third-party
import { Select } from "@cliffy/prompt";

// 3. Local modules
import { NocoDBClient } from "../api/nocodb.ts";
import { ConfigManager } from "../config/manager.ts";
```

### Type Safety

**Always add types:**

```typescript
// ✓ Good
function getProject(id: string): Promise<Project> {
  return ...;
}

// ✗ Avoid
function getProject(id) {
  return ...;
}
```

**Use interfaces for data structures:**

```typescript
interface Project {
  title: string;
  uuid: string;
  notes: string;
  area?: string;
}
```

**Avoid `any`:**

```typescript
// ✗ Avoid
const data: any = response.json();

// ✓ Better
const data: Record<string, unknown> = response.json();

// ✓ Best
const data: NocoDBRecord = response.json();
```

### Error Handling

**Throw descriptive errors:**

```typescript
if (!config.nocodbUrl) {
  throw new Error(
    "NocoDB URL not configured. Run: deno task start config --set",
  );
}
```

**Catch at appropriate level:**

```typescript
// Catch in CLI layer, not API layer
try {
  await syncProjects();
} catch (error) {
  console.error(colors.red(`❌ ${error.message}`));
  Deno.exit(1);
}
```

### Async/Await

**Always use async/await:**

```typescript
// ✓ Good
async function fetchRecords() {
  const response = await fetch(url);
  return await response.json();
}

// ✗ Avoid
function fetchRecords() {
  return fetch(url).then((r) => r.json());
}
```

## Testing

### Test File Structure

```typescript
// Import test utilities
import { assertEquals, assertRejects } from "@std/assert";

// Test setup
Deno.test("NocoDBClient - getRecords", async () => {
  // Arrange
  const client = new NocoDBClient(url, token, tableId);

  // Act
  const records = await client.getRecords();

  // Assert
  assertEquals(records.length, 10);
});
```

### Test Categories

#### Unit Tests

Test individual functions/methods in isolation.

```typescript
Deno.test("ConfigManager - load", async () => {
  const config = await ConfigManager.load();
  assertEquals(typeof config.nocodbUrl, "string");
});
```

#### Integration Tests

Test interactions between components.

```typescript
Deno.test("Sync - full workflow", async () => {
  // Test Things → NocoDB sync
  const result = await syncCommand({ dryRun: true });
  assertEquals(result.synced, 5);
});
```

### Mocking

For testing without external dependencies:

```typescript
// Mock NocoDB API
const mockFetch = (url: string) => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ records: [] }),
  });
};

// Override global fetch for test
globalThis.fetch = mockFetch as any;
```

### Test Coverage

```bash
# Generate coverage
deno test --coverage=coverage/

# View coverage report
deno coverage coverage/

# HTML report
deno coverage coverage/ --html

# Open in browser
open coverage/html/index.html
```

**Target:** Aim for 70%+ code coverage

## Debugging

### Debug Mode

Use prjsync's built-in debug mode:

```bash
deno task start sync --debug --uuid ABC123
```

Shows:

- API requests/responses
- Search logic
- Field mappings
- Status tag operations

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug prjsync",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "deno",
      "runtimeArgs": [
        "run",
        "--inspect-brk",
        "--allow-all",
        "src/cli/index.ts"
      ],
      "attachSimplePort": 9229
    }
  ]
}
```

**Usage:**

1. Set breakpoints in code
2. Press F5 or click "Debug"
3. Step through code execution

### Console Logging

```typescript
// Development logging
console.log("Debug:", value);
console.error("Error:", error);

// Production: Use colors
import { colors } from "@std/fmt/colors";
console.log(colors.green("✓ Success"));
console.error(colors.red("❌ Error"));
```

### Debug Files

Debug mode saves API responses:

```
.prjsync-debug/nocodb-records-{timestamp}.json
```

Review these files to inspect NocoDB data offline.

## Building and Distribution

### Compile Standalone Executable

```bash
deno task compile
```

**Output:**

- `dist/prjsync` (macOS/Linux)
- `dist/prjsync.exe` (Windows)

**Features:**

- No Deno runtime required
- Single executable file
- All dependencies bundled

### Install Locally

```bash
deno task install
```

**Installs to:** `/usr/local/bin/prjsync`

**Usage after install:**

```bash
prjsync sync
prjsync map
prjsync config --show
```

### Uninstall

```bash
rm /usr/local/bin/prjsync
```

## Code Quality Checklist

Before committing:

- [ ] Code formatted (`deno task fmt`)
- [ ] No linting errors (`deno task lint`)
- [ ] Types check (`deno task check`)
- [ ] Tests pass (`deno task test`)
- [ ] No console.log debug statements
- [ ] Error messages are helpful
- [ ] Code is documented (complex logic)

## Contributing

### Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/new-feature
   ```

3. **Make changes**
   - Write code
   - Add tests
   - Update documentation

4. **Test thoroughly**
   ```bash
   deno task test
   deno task lint
   deno task fmt --check
   ```

5. **Commit with clear message**
   ```bash
   git commit -m "feat: add new feature"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/new-feature
   ```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `test` - Add/update tests
- `chore` - Maintenance tasks

**Examples:**

```
feat(sync): add status tag synchronization
fix(config): handle missing configuration file
docs: update getting started guide
refactor(api): simplify NocoDB client
```

### Pull Request Guidelines

**PR Description should include:**

- What changed
- Why it changed
- How to test
- Related issues (if any)

**Example:**

```markdown
## Summary

Adds bidirectional status synchronization from NocoDB to Things.

## Changes

- New status sync logic in sync command
- Updated NocoDB client to fetch field options
- Added tag management to Things client

## Testing

1. Map a Status field
2. Run: `deno task start sync --verbose`
3. Verify status tags update in Things

## Related Issues

Fixes #42
```

## Common Tasks

### Adding a New Command

1. **Create command file:**
   ```bash
   touch src/cli/commands/my-command.ts
   ```

2. **Implement command:**
   ```typescript
   export async function myCommand(options: Options) {
     // Implementation
   }
   ```

3. **Add route in index.ts:**
   ```typescript
   case 'my-command':
     await myCommand(args);
     break;
   ```

4. **Add tests:**
   ```bash
   touch src/cli/commands/my-command_test.ts
   ```

5. **Document:**
   - Update `docs/reference/commands.md`
   - Update README.md if major feature

### Adding a New API Method

1. **Add method to client:**
   ```typescript
   async myMethod(params: Params): Promise<Result> {
     const response = await fetch(...);
     return await response.json();
   }
   ```

2. **Add tests:**
   ```typescript
   Deno.test("Client - myMethod", async () => {
     // Test implementation
   });
   ```

3. **Use in commands:**
   ```typescript
   const result = await client.myMethod(params);
   ```

### Updating Dependencies

```bash
# Update deno.lock
deno cache --reload src/cli/index.ts

# Or update specific import
deno cache --reload=jsr:@std/cli src/cli/index.ts
```

## Troubleshooting Development

### "Permission denied" errors

Ensure all required permissions in `deno.json`:

```json
{
  "tasks": {
    "dev": "deno run --allow-all --watch src/cli/index.ts"
  }
}
```

### Type errors in tests

Import assertion utilities:

```typescript
import { assertEquals } from "@std/assert";
```

### AppleScript not working

Ensure Things 3 is running and permissions granted:

- System Preferences → Security & Privacy → Privacy → Automation
- Enable Deno/Terminal to control Things

### NocoDB API errors

Check:

- API token is valid
- Table ID is correct
- Network connectivity

## Resources

- [Deno Manual](https://docs.deno.com/)
- [Deno Standard Library](https://deno.land/std)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Related Documentation

- [Architecture](explanation/architecture.md) - System design
- [Project Structure](explanation/project-structure.md) - Code organization
- [Commands Reference](reference/commands.md) - All CLI commands
