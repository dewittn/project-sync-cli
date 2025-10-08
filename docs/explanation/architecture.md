# Architecture

This document explains how prjsync is designed and how its components work together.

## System Overview

prjsync is a command-line application that acts as a bridge between Things 3 (a macOS task management app) and NocoDB (a database platform with REST API).

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│             │         │              │         │              │
│  Things 3   │◄───────►│   prjsync    │◄───────►│   NocoDB     │
│  (macOS)    │         │  (Deno CLI)  │         │  (REST API)  │
│             │         │              │         │              │
└─────────────┘         └──────────────┘         └──────────────┘
     ▲                         │                         ▲
     │                         ▼                         │
     │                  ┌──────────────┐                │
     │                  │ Config       │                │
     └──AppleScript────►│ ~/.prjsync/  │◄────HTTPS─────┘
                        │ config.json  │
                        └──────────────┘
```

**Data Flow:**
1. User runs `prjsync sync`
2. prjsync reads configuration from `~/.prjsync/config.json`
3. prjsync fetches projects from Things via AppleScript
4. prjsync fetches records from NocoDB via REST API
5. prjsync matches, creates, or updates records
6. prjsync syncs status tags back to Things

## Architecture Layers

prjsync follows a clean layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────┐
│              CLI Layer (User Interface)              │
│  • Command parsing and routing                       │
│  • Interactive prompts and output                    │
│  • Help messages and usage documentation             │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│           Configuration Layer (State)                │
│  • Configuration management                          │
│  • Field mapping storage                             │
│  • Sync statistics tracking                          │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│             API Layer (External Systems)             │
│  ┌─────────────────┐      ┌────────────────────┐   │
│  │  Things Client  │      │   NocoDB Client    │   │
│  │  (AppleScript)  │      │   (REST API)       │   │
│  └─────────────────┘      └────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### CLI Layer (`src/cli/`)

**Responsibilities:**
- Parse command-line arguments
- Route commands to appropriate handlers
- Display output to user
- Handle interactive prompts
- Format errors and success messages

**Key Files:**
- `cli/index.ts` - Entry point, command routing
- `cli/commands/*.ts` - Individual command implementations

**Design Decisions:**
- Uses Deno's standard library for argument parsing (`@std/cli/parse-args`)
- Cliffy library for interactive prompts (`@cliffy/prompt`)
- Colorful output with `@std/fmt/colors`
- Each command is a separate module for maintainability

### Configuration Layer (`src/config/`)

**Responsibilities:**
- Load and save configuration
- Manage field mappings
- Track sync statistics
- Encrypt/decrypt sensitive data

**Key Files:**
- `config/manager.ts` - Configuration CRUD operations

**Storage:**
- File: `~/.prjsync/config.json`
- Format: JSON
- Permissions: User-only read/write (600)

**Design Decisions:**
- Single configuration file for simplicity
- API tokens stored with basic encryption
- Field mappings stored as array of objects
- Statistics tracked automatically

### API Layer (`src/api/`)

**Responsibilities:**
- Abstract external system APIs
- Handle authentication
- Manage API requests and responses
- Parse and normalize data

**Components:**

#### Things Client (`src/api/things.ts`)

**Interface:**
- `listProjects()` - Get all active projects
- `getProjectTags(uuid)` - Get tags for a project
- `addTag(uuid, tag)` - Add a tag to a project
- `removeTag(uuid, tag)` - Remove a tag from a project

**Implementation:**
- Uses AppleScript via `osascript` command
- Parses AppleScript output (complex text format)
- Filters out completed and recurring projects
- Handles Things-specific data structures

**Challenges:**
- No official Things API
- AppleScript output is unstructured text
- Requires Things to be running
- Limited error reporting from AppleScript

#### NocoDB Client (`src/api/nocodb.ts`)

**Interface:**
- `getRecords()` - Fetch all records (with pagination)
- `createRecord(data)` - Create new record
- `updateRecord(id, data)` - Update existing record
- `getFieldOptions(fieldName)` - Get Single Select options
- `searchRecords(filters)` - Search with conditions

**Implementation:**
- REST API using `fetch()`
- Token-based authentication via `xc-token` header
- Automatic pagination (100 records per request)
- Comprehensive error handling with HTTP details

**API Details:**
- Base URL: `{nocodbUrl}/api/v2/tables/{tableId}/records`
- Authentication: HTTP header `xc-token: {token}`
- Pagination: Query params `limit` and `offset`
- Filtering: Query param `where` (JSON condition)

## Data Flow

### Sync Operation Flow

```
1. Initialize
   ├─ Load configuration
   ├─ Load field mappings
   └─ Validate settings

2. Fetch Data
   ├─ Fetch Things projects via AppleScript
   │  └─ Filter out completed/recurring
   ├─ Fetch NocoDB records via API
   │  └─ Paginate (100 per request)
   └─ Prepare for matching

3. Match Projects
   For each Things project:
   ├─ Search by UUID (primary)
   │  └─ Query NocoDB UUID field
   ├─ Search by title (fallback)
   │  └─ Query NocoDB title field
   └─ If no match:
      └─ Prompt user (create/skip/find)

4. Sync Data
   For each matched/created project:
   ├─ Map Things properties to NocoDB fields
   ├─ Create or update NocoDB record
   ├─ Receive NocoDB response
   └─ Apply status tag (if configured)

5. Status Tag Sync
   For each synced project:
   ├─ Read Status field from NocoDB
   ├─ Get current tags from Things
   ├─ Remove old status tags
   ├─ Add new status tag
   └─ Preserve non-status tags

6. Finalize
   ├─ Display summary
   ├─ Update sync statistics
   └─ Save configuration
```

### Authentication Flow

#### Things 3 Authentication

```
User runs prjsync
     │
     ▼
Execute osascript command
     │
     ▼
macOS Permission System
     │
     ├─ First run: Prompt user for permission
     │              (System Preferences → Security & Privacy → Automation)
     │
     └─ Subsequent runs: Use granted permission
         │
         ▼
   Things app receives command
         │
         ▼
   Returns project data
         │
         ▼
   prjsync parses response
```

#### NocoDB Authentication

```
User provides API token during config setup
     │
     ▼
Token stored in ~/.prjsync/config.json
     │
     ▼
Each API request includes header:
    xc-token: {user's token}
     │
     ▼
NocoDB validates token
     │
     ├─ Valid: Process request
     │
     └─ Invalid: Return 401/403 error
         │
         ▼
   prjsync displays error to user
```

## Component Interactions

### Sync Command Interaction

```
User: deno task start sync
          │
          ▼
    ┌──────────┐
    │ CLI      │
    │ index.ts │
    └──────────┘
          │
          ├─► Load Config (ConfigManager)
          │       │
          │       └─► Read ~/.prjsync/config.json
          │
          ├─► Fetch Things Projects (ThingsClient)
          │       │
          │       └─► osascript → Things → Parse output
          │
          ├─► Fetch NocoDB Records (NocoDBClient)
          │       │
          │       └─► HTTPS → NocoDB API → Parse JSON
          │
          ├─► Match Projects (Sync Logic)
          │       │
          │       ├─► For each project:
          │       │   ├─► Search by UUID
          │       │   └─► Search by title
          │       │
          │       └─► Interactive prompt if no match
          │
          ├─► Sync Data (NocoDBClient)
          │       │
          │       ├─► Map fields
          │       ├─► POST/PATCH request
          │       └─► Handle response
          │
          ├─► Sync Status Tags (ThingsClient)
          │       │
          │       ├─► Get current tags
          │       ├─► Remove old status tags
          │       └─► Add new status tag
          │
          └─► Display Results & Update Stats
                  │
                  └─► Save to config.json
```

## Error Handling Strategy

prjsync uses layered error handling:

### Layer 1: API Errors

**NocoDB API Errors:**
- Caught at API client level
- HTTP status codes examined
- Error messages extracted from response
- Wrapped in descriptive error with context

**Things AppleScript Errors:**
- Exit codes checked
- stderr output captured
- Common errors (app not running) handled specifically

### Layer 2: Business Logic Errors

**Configuration Errors:**
- Missing or invalid configuration
- Friendly error messages
- Guidance on how to fix

**Mapping Errors:**
- Missing required mappings
- Field not found in NocoDB
- Clear explanation of what's wrong

### Layer 3: User-Facing Errors

**Display:**
- Colorful output (red for errors)
- Clear error messages
- Suggested actions
- Exit with appropriate exit code

**Example:**
```
❌ Error: NocoDB connection failed

Details: HTTP 401 Unauthorized
Possible causes:
  • Invalid or expired API token
  • Incorrect NocoDB URL
  • Table ID not found

Solutions:
  1. Verify your API token in NocoDB
  2. Regenerate token: Profile → Account Settings → Tokens
  3. Update configuration: deno task start config --set

Need help? See docs/how-to/troubleshooting.md
```

## Performance Considerations

### NocoDB API Pagination

**Challenge:** Large tables with thousands of records

**Solution:**
- Fetch records in batches of 100
- Use offset-based pagination
- Process all batches sequentially

**Trade-off:**
- More reliable than large single requests
- Slower for very large tables
- Simple implementation

### Things AppleScript Performance

**Challenge:** AppleScript is slow for large operations

**Solution:**
- Single batch operation to fetch all projects
- Cache project data in memory
- Minimize AppleScript calls

**Trade-off:**
- Fast for typical use (10-100 projects)
- May be slow for users with 1000+ projects

### Caching Strategy

**Current approach:** No persistent caching

**Rationale:**
- Sync is manual, not automatic
- Data freshness is priority
- Configuration is lightweight

**Future consideration:** Cache NocoDB records between syncs for faster matching.

## Extensibility

### Adding New Commands

1. Create new file in `src/cli/commands/`
2. Export command handler function
3. Add route in `src/cli/index.ts`
4. Document in `docs/reference/commands.md`

### Adding New Field Types

1. Update Things client to extract new property
2. Update field mapping logic
3. Document new property
4. Test with various NocoDB field types

### Supporting Other Task Managers

Architecture supports swapping Things client:

1. Create new client implementing same interface:
   - `listProjects()`
   - `getProjectTags()`
   - `addTag()`
   - `removeTag()`

2. Update CLI to use new client

3. No changes needed to sync logic or NocoDB client

## Technology Choices

### Why Deno?

**Advantages:**
- TypeScript support out of the box
- Modern standard library
- Secure by default (permissions)
- Single executable
- No package.json complexity

**Trade-offs:**
- Smaller ecosystem than Node.js
- Some libraries not Deno-compatible
- Requires Deno runtime installation

### Why AppleScript for Things?

**Constraint:** Things has no public API

**Solution:** AppleScript is the only official automation method

**Challenges:**
- Parsing unstructured text output
- Slow execution
- Limited error reporting

**Alternative considered:** Things URL scheme (rejected due to limitations)

### Why REST API for NocoDB?

**Advantages:**
- Official, documented API
- Token-based auth (simple)
- JSON responses (easy to parse)
- Full CRUD support

**Trade-offs:**
- Requires network connectivity
- Rate limiting considerations
- No real-time updates

## Related Documentation

- [Project Structure](project-structure.md) - Code organization
- [Sync Strategy](sync-strategy.md) - Sync algorithm details
- [Development Guide](../development.md) - Building and testing
