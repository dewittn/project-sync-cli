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

| Property         | Type   | Description                              | Required |
| ---------------- | ------ | ---------------------------------------- | -------- |
| `nocodbField`    | String | Exact NocoDB field name (case-sensitive) | Yes      |
| `thingsProperty` | String | Things property identifier               | Yes      |

#### Valid Things Properties

| Property | Description                   | Maps To                |
| -------- | ----------------------------- | ---------------------- |
| `title`  | Project title/name            | Single Line Text field |
| `id`     | Project UUID                  | Single Line Text field |
| `notes`  | Project description/notes     | Long Text field        |
| `area`   | Project area                  | Single Line Text field |
| `status` | Status for bidirectional sync | Single Select field    |

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
- **One field per property**: Each Things property can only map to one NocoDB
  field
- **No duplicate mappings**: Each NocoDB field can only map to one Things
  property

---

### `syncStats` (Auto-Generated)

Statistics and history of sync operations. This is automatically managed by
prjsync.

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

| Field             | Type              | Description                     |
| ----------------- | ----------------- | ------------------------------- |
| `lastSync`        | ISO 8601 DateTime | Timestamp of most recent sync   |
| `totalSyncs`      | Number            | Total number of syncs performed |
| `lastSyncResults` | Object            | Results of most recent sync     |

#### `lastSyncResults` Fields

| Field            | Type   | Description              |
| ---------------- | ------ | ------------------------ |
| `projectsSynced` | Number | Total projects synced    |
| `created`        | Number | New records created      |
| `updated`        | Number | Existing records updated |
| `errors`         | Number | Errors encountered       |

**Note:** Do not manually edit `syncStats` - it's managed automatically by
prjsync.

---

## Recommended NocoDB Field Types

When creating fields in NocoDB to sync with Things properties:

| Things Property | Recommended NocoDB Field Type           |
| --------------- | --------------------------------------- |
| `title`         | Single Line Text                        |
| `id` (UUID)     | Single Line Text                        |
| `notes`         | Long Text                               |
| `area`          | Single Line Text                        |
| `status`        | Single Select (with predefined options) |

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

prjsync currently supports only one configuration file. For multiple
environments:

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

### ⚠️ Important: Credential Storage

**API tokens are stored in plain text** in the configuration file at:

```
~/.prjsync/config.json
```

While the configuration file is created with user-only permissions, the NocoDB
API token is **not encrypted** and is stored as plain text in this file. This
means:

- Anyone with read access to this file can see your API token
- If your home directory is backed up, the token is included in backups
- If you share your computer, other users with sudo/admin access could
  potentially read this file

### Recommended Security Practices

#### 1. Set Restrictive File Permissions

Ensure your configuration file has restrictive permissions:

```bash
chmod 600 ~/.prjsync/config.json
```

This ensures only your user account can read/write the file.

**Verify permissions:**

```bash
ls -l ~/.prjsync/config.json
# Should show: -rw------- (600)
```

#### 2. Protect Your Configuration Directory

Secure the entire prjsync directory:

```bash
chmod 700 ~/.prjsync
```

#### 3. API Token Best Practices

- **Never commit** `config.json` to version control
- **Never share** your API token with others
- **Regenerate tokens** immediately if you suspect compromise
- **Use limited scope tokens** when possible in NocoDB
- **Revoke unused tokens** regularly in NocoDB settings

#### 4. Backup Security

If you backup your home directory:

- Be aware that backups contain your API token
- Encrypt backups or exclude `~/.prjsync/config.json`
- Store backups securely

Example to exclude from Time Machine:

```bash
tmutil addexclusion ~/.prjsync
```

#### 5. Shared Computer Considerations

If you share your computer with others:

- Remember that admin users can potentially read any file
- Consider using a separate user account for prjsync
- Revoke and regenerate tokens when switching users

### High-Security Environments

For environments requiring enhanced security:

1. **Use a dedicated NocoDB token** with minimal permissions
   - Only grant read/write access to the specific table
   - Create a service account in NocoDB specifically for prjsync

2. **Store configuration on encrypted storage**
   - Use FileVault (macOS disk encryption)
   - Or store `~/.prjsync/` on an encrypted volume

3. **Rotate tokens frequently**
   ```bash
   # Generate new token in NocoDB
   deno task start config --set
   # Enter new token when prompted
   ```

4. **Monitor token usage**
   - Regularly check NocoDB audit logs for unexpected API usage

### What to Do If Your Token Is Compromised

1. **Immediately revoke the token** in NocoDB:
   - Log into NocoDB
   - Go to Account Settings → Tokens
   - Delete the compromised token

2. **Generate a new token** in NocoDB

3. **Update your configuration**:
   ```bash
   deno task start config --set
   ```

4. **Review NocoDB audit logs** for any unauthorized activity

### Future Security Improvements

The following security enhancements are planned for future releases:

- Environment variable support for API tokens
- Encrypted configuration file storage
- Integration with system keychain (macOS Keychain)

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
