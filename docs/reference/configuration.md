# Configuration Reference

Complete reference for prjsync configuration file structure and options.

## Configuration File Location

```
~/.prjsync/config.json
```

This file is created automatically when you run:
```bash
deno task start config --set
```

## File Structure

```json
{
  "nocodbUrl": "https://nocodb.example.com",
  "nocodbToken": "xc-token-encrypted-value",
  "tableId": "t_abcdefgh",
  "fieldMappings": [
    {
      "nocodbField": "Project Name",
      "thingsProperty": "title"
    },
    {
      "nocodbField": "Things UUID",
      "thingsProperty": "id"
    }
  ],
  "syncStats": {
    "lastSync": "2025-03-15T10:30:45.123Z",
    "totalSyncs": 42,
    "lastSyncResults": {
      "projectsSynced": 15,
      "created": 3,
      "updated": 12,
      "errors": 0
    }
  }
}
```

## Configuration Fields

### `nocodbUrl` (Required)

The URL of your NocoDB instance.

**Type:** String (URL)

**Format:**
- Must start with `http://` or `https://`
- No trailing slash
- No path components (like `/api/v2`)

**Valid Examples:**
```json
"nocodbUrl": "https://nocodb.example.com"
"nocodbUrl": "https://app.nocodb.com"
"nocodbUrl": "http://localhost:8080"
```

**Invalid Examples:**
```json
"nocodbUrl": "https://nocodb.example.com/"      // trailing slash
"nocodbUrl": "https://nocodb.example.com/api"   // path included
"nocodbUrl": "nocodb.example.com"               // missing protocol
```

---

### `nocodbToken` (Required)

Your NocoDB API authentication token.

**Type:** String

**How to Generate:**
1. Log into NocoDB
2. Click your profile icon
3. Go to "Account Settings"
4. Navigate to "Tokens" tab
5. Click "Create Token"
6. Copy the generated token

**Security:**
- Stored with basic encryption in config file
- Never shared or logged
- Masked in `config --show` output

**Token Format:**
- Usually starts with `xc-token-`
- Long alphanumeric string

**Example:**
```json
"nocodbToken": "xc-token-abc123def456ghi789jkl012mno345"
```

**Permissions Required:**
- Read access to the target table
- Write access to create/update records
- Access to table metadata (field information)

---

### `tableId` (Required)

The unique identifier of the NocoDB table to sync projects to.

**Type:** String

**Format:** Usually starts with `t_` followed by alphanumeric characters

**How to Find:**

**Method 1: From NocoDB URL**

When viewing your table in NocoDB, check the URL:
```
https://nocodb.example.com/nc/p01234567/t_abcdefgh
                                         ^^^^^^^^^^^
                                         This is your table ID
```

**Method 2: From NocoDB API**

Use the NocoDB API explorer to list tables and find the ID.

**Example:**
```json
"tableId": "t_abcdefgh"
```

---

### `fieldMappings` (Required)

Array of mappings between Things properties and NocoDB fields.

**Type:** Array of objects

**Structure:**
```json
"fieldMappings": [
  {
    "nocodbField": "NocoDB Field Name",
    "thingsProperty": "things_property"
  }
]
```

#### Field Mapping Object

| Property | Type | Description | Required |
|----------|------|-------------|----------|
| `nocodbField` | String | Exact NocoDB field name (case-sensitive) | Yes |
| `thingsProperty` | String | Things property identifier | Yes |

#### Valid Things Properties

| Property | Description | Maps To |
|----------|-------------|---------|
| `title` | Project title/name | Single Line Text field |
| `id` | Project UUID | Single Line Text field |
| `notes` | Project description/notes | Long Text field |
| `area` | Project area | Single Line Text field |
| `status` | Status for bidirectional sync | Single Select field |

#### Example Mappings

```json
"fieldMappings": [
  {
    "nocodbField": "Project Name",
    "thingsProperty": "title"
  },
  {
    "nocodbField": "Things UUID",
    "thingsProperty": "id"
  },
  {
    "nocodbField": "Description",
    "thingsProperty": "notes"
  },
  {
    "nocodbField": "Category",
    "thingsProperty": "area"
  },
  {
    "nocodbField": "Status",
    "thingsProperty": "status"
  }
]
```

#### Important Notes

- **Field names are case-sensitive**: "Project Name" ≠ "project name"
- **At minimum, map `title`**: Required for basic sync
- **Strongly recommend mapping `id`**: For reliable project tracking
- **Status mapping is optional**: Only needed for bidirectional status sync
- **One field per property**: Each Things property can only map to one NocoDB field
- **No duplicate mappings**: Each NocoDB field can only map to one Things property

---

### `syncStats` (Auto-Generated)

Statistics and history of sync operations. This is automatically managed by prjsync.

**Type:** Object

**Structure:**
```json
"syncStats": {
  "lastSync": "2025-03-15T10:30:45.123Z",
  "totalSyncs": 42,
  "lastSyncResults": {
    "projectsSynced": 15,
    "created": 3,
    "updated": 12,
    "errors": 0
  }
}
```

#### `syncStats` Fields

| Field | Type | Description |
|-------|------|-------------|
| `lastSync` | ISO 8601 DateTime | Timestamp of most recent sync |
| `totalSyncs` | Number | Total number of syncs performed |
| `lastSyncResults` | Object | Results of most recent sync |

#### `lastSyncResults` Fields

| Field | Type | Description |
|-------|------|-------------|
| `projectsSynced` | Number | Total projects synced |
| `created` | Number | New records created |
| `updated` | Number | Existing records updated |
| `errors` | Number | Errors encountered |

**Note:** Do not manually edit `syncStats` - it's managed automatically by prjsync.

---

## Recommended NocoDB Field Types

When creating fields in NocoDB to sync with Things properties:

| Things Property | Recommended NocoDB Field Type |
|-----------------|-------------------------------|
| `title` | Single Line Text |
| `id` (UUID) | Single Line Text |
| `notes` | Long Text |
| `area` | Single Line Text |
| `status` | Single Select (with predefined options) |

### Status Field Requirements

For bidirectional status sync to work:

1. **Field type must be Single Select**
   - Not Multi Select
   - Not Text or other types

2. **Options must be predefined**
   - Define all status values in NocoDB
   - Examples: "To Do", "In Progress", "Review", "Done"

3. **Option names become tags**
   - "In Progress" in NocoDB → "In Progress" tag in Things
   - Case and spacing must match exactly

---

## Manual Configuration Editing

You can manually edit the configuration file if needed.

### Backup First

Always backup before editing:
```bash
cp ~/.prjsync/config.json ~/.prjsync/config.json.backup
```

### Edit Configuration

```bash
nano ~/.prjsync/config.json
# or
code ~/.prjsync/config.json
# or use any text editor
```

### Validate After Editing

Test the configuration:
```bash
deno task start test
```

### Common Manual Edits

**Add a field mapping:**
```json
{
  "nocodbField": "New Field Name",
  "thingsProperty": "notes"
}
```

**Remove a field mapping:**

Delete the entire object from the `fieldMappings` array.

**Change NocoDB URL:**
```json
"nocodbUrl": "https://new-nocodb-instance.com"
```

**Update table ID:**
```json
"tableId": "t_newTableId"
```

---

## Configuration Commands

### View Configuration

```bash
deno task start config --show
```

Shows:
- NocoDB URL
- Table ID
- Field mappings count
- API token (masked)

### Interactive Setup

```bash
deno task start config --set
```

Prompts for:
- NocoDB URL
- API token
- Table ID

Does not prompt for field mappings (use `map` command for that).

### Reset Configuration

```bash
deno task start config --reset
```

Deletes the configuration file. You'll need to reconfigure from scratch.

### Reconfigure

```bash
deno task start config --reset && deno task start config --set
```

Deletes and recreates configuration.

---

## Multiple Environments

prjsync currently supports only one configuration file. For multiple environments:

### Option 1: Manual Switching

```bash
# Backup production config
cp ~/.prjsync/config.json ~/.prjsync/config.production.json

# Switch to development
cp ~/.prjsync/config.development.json ~/.prjsync/config.json

# Sync with development
deno task start sync

# Switch back to production
cp ~/.prjsync/config.production.json ~/.prjsync/config.json
```

### Option 2: Separate Machines/Users

Use different machines or user accounts for different environments.

---

## Security Considerations

### File Permissions

Configuration file should have restrictive permissions:

```bash
chmod 600 ~/.prjsync/config.json
```

This ensures only your user can read/write the file.

### API Token Security

- **Never commit** config.json to version control
- **Never share** your API token
- **Regenerate tokens** if compromised
- **Use limited scope tokens** when possible

### Encrypted Storage

API tokens are stored with basic encryption in the config file. This provides protection against casual inspection but is not cryptographically secure.

For high-security environments:
- Use environment variables for tokens (not yet supported)
- Store config on encrypted disk
- Regenerate tokens frequently

---

## Troubleshooting Configuration

### "Configuration not found"

**Cause:** Config file doesn't exist.

**Solution:**
```bash
deno task start config --set
```

### "Invalid configuration"

**Cause:** Malformed JSON or missing required fields.

**Solution:**

1. Check JSON syntax:
```bash
cat ~/.prjsync/config.json | jq .
```

2. If corrupted, reset and reconfigure:
```bash
deno task start config --reset
deno task start config --set
```

### Configuration Not Taking Effect

**Cause:** Caching or wrong file location.

**Solution:**

1. Verify file location:
```bash
ls -la ~/.prjsync/config.json
```

2. Check file contents:
```bash
cat ~/.prjsync/config.json
```

3. Test configuration:
```bash
deno task start config --show
```

---

## Related Documentation

- [Commands Reference](commands.md) - Configuration commands
- [Getting Started](../tutorials/getting-started.md) - Initial setup
- [Troubleshooting](../how-to/troubleshooting.md) - Configuration issues
