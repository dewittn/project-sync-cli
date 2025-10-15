# Interactive Prompts Reference

Complete reference for all interactive prompts in prjsync.

## No Matching Record Prompt

### When It Appears

During sync, when a Things project has no matching NocoDB record (no UUID match
and no title match).

### Prompt Display

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No matching record found for project: "Project Name"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Things Project Details:
  Title:  Project Name
  UUID:   ABC123-DEF456
  Area:   Work
  Notes:  Project description here...

Options: [c]Create new / [f]Find & select / [s]Skip all / [d]Debug / [n]Skip this:
```

### Response Options

| Input     | Action        | Description                                                  |
| --------- | ------------- | ------------------------------------------------------------ |
| `c`       | Create        | Create a new NocoDB record with this project's data          |
| `f`       | Find & Select | Search existing records with fuzzy matching to manually link |
| `s`       | Skip All      | Stop syncing and skip all remaining projects                 |
| `d`       | Debug         | Show detailed debug information, then re-prompt              |
| `n`       | Skip This     | Skip only this project, continue with next (default)         |
| `<Enter>` | Skip This     | Same as `n` (default action)                                 |

### Detailed Option Behavior

#### `c` - Create New Record

**What happens:**

1. New record created in NocoDB
2. All mapped fields populated from Things project
3. UUID stored in NocoDB for future matching
4. Status sync applied (if configured)
5. Sync continues with next project

**When to use:**

- This is genuinely a new project not in NocoDB
- You want to create a record automatically

**Example output:**

```
Creating new NocoDB record...
✓ Created record (ID: 123)
```

#### `f` - Find & Select

**What happens:**

1. Fuzzy search interface opens
2. All NocoDB records loaded
3. Type to filter records in real-time
4. Arrow keys navigate through matches
5. Enter selects a record
6. Selected record updated with project data and UUID
7. Status sync applied (if configured)
8. Sync continues with next project

**When to use:**

- Record exists but title doesn't match exactly
- Project was renamed in Things
- You want to manually link to an existing record

**Example:**

```
Search records (type to filter):
> web

Matching records:
→ Launch Website (ID: 45)
  Marketing Website Update (ID: 67)
  Web Application Redesign (ID: 89)

Use ↑↓ to navigate, Enter to select, Esc to cancel
```

#### `s` - Skip All

**What happens:**

1. Current project is skipped
2. All remaining projects are skipped
3. Sync ends immediately
4. Summary shown with counts

**When to use:**

- You realize field mappings need adjustment
- Too many unmatched projects
- You want to stop and review configuration

**Example output:**

```
Skipping all remaining projects...
Sync stopped.

Results: 5 projects synced, 10 skipped
```

#### `d` - Debug

**What happens:**

1. Detailed debug information displayed
2. Shows NocoDB search details
3. Shows which fields were checked
4. Shows why no match was found
5. Re-prompts with same options

**When to use:**

- You expected a match but didn't get one
- Investigating why matching isn't working
- Understanding the search process

**Example output:**

```
Debug Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Search Process:
1. UUID Search
   - Field checked: Things UUID
   - Value searched: ABC123-DEF456
   - Records with this UUID: 0

2. Title Search
   - Field checked: Project Name
   - Value searched: "Project Name"
   - Records with this title: 0

Available NocoDB Records:
- Project Alpha (UUID: XYZ789)
- Project Beta (UUID: none)
- Project Gamma (UUID: none)

No match found because:
- No record has UUID "ABC123-DEF456"
- No record has title "Project Name"

Options: [c]Create new / [f]Find & select / [s]Skip all / [d]Debug / [n]Skip this:
```

#### `n` - Skip This (Default)

**What happens:**

1. Current project is skipped
2. Sync continues with next project
3. Skipped project not synced

**When to use:**

- You'll handle this project manually later
- Project shouldn't be synced
- Want to skip temporarily and continue

**Example output:**

```
Skipping project...
```

---

## Fuzzy Search Interface

### When It Appears

When you choose `f` (Find & Select) from the No Matching Record prompt.

### Interface Display

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Find and Select Record
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Things Project:
  Title: Project Name
  UUID: ABC123-DEF456

Search (type to filter, ↑↓ to navigate, Enter to select, Esc to cancel):
>

All Records (42):
→ Project Alpha (ID: 1)
  Project Beta (ID: 2)
  Project Gamma (ID: 3)
  ...
```

### Controls

| Key         | Action                                        |
| ----------- | --------------------------------------------- |
| Type        | Filter records by search text                 |
| `↑` / `↓`   | Navigate through filtered results             |
| `Enter`     | Select highlighted record and link to project |
| `Esc`       | Cancel and return to previous prompt          |
| `Backspace` | Delete last character from search             |

### Search Behavior

**Fuzzy Matching:**

- Searches across record title and ID
- Case-insensitive
- Matches anywhere in the text
- Real-time filtering as you type

**Examples:**

Search: `web`

- Matches: "Launch **Web**site"
- Matches: "**Web** Application"
- Matches: "Corporate **Web**page"

Search: `proj alpha`

- Matches: "**Proj**ect **Alpha**"
- Matches: "**Alpha** **Proj**ect"

### After Selection

```
Selected: Project Alpha (ID: 1)

Updating record with project data...
✓ Updated record
✓ Status sync: Added tag "In Progress"

Continuing with next project...
```

The selected record is:

1. Updated with all project data
2. UUID field updated for future matching
3. Status synced to Things (if configured)

---

## Configuration Setup Prompt

### When It Appears

When you run: `deno task start config --set`

### Prompt Sequence

#### 1. NocoDB URL

```
Enter NocoDB URL (e.g., https://nocodb.example.com):
>
```

**Expected format:**

- Full URL including `https://` or `http://`
- No trailing slash
- No path components

**Examples:**

- ✓ `https://nocodb.example.com`
- ✓ `https://app.nocodb.com`
- ✓ `http://localhost:8080`
- ✗ `https://nocodb.example.com/` (trailing slash)
- ✗ `nocodb.example.com` (missing protocol)

#### 2. NocoDB API Token

```
Enter NocoDB API Token:
>
```

**Expected format:**

- Long alphanumeric string
- Usually starts with `xc-token-`

**Input is hidden:** Characters not displayed for security.

**How to get token:**

1. Log into NocoDB
2. Profile → Account Settings → Tokens
3. Create Token
4. Copy and paste

#### 3. Table ID

```
Enter Table ID (e.g., t_abcdefgh):
>
```

**Expected format:**

- Usually starts with `t_`
- Followed by alphanumeric characters

**How to find:**

- Check NocoDB URL when viewing table
- Example URL: `https://nocodb.example.com/nc/p01234567/t_abcdefgh`
- Table ID: `t_abcdefgh`

### Completion

```
✓ Configuration saved to ~/.prjsync/config.json

Next steps:
1. Set up field mappings: deno task start map
2. Test connection: deno task start test
```

---

## Field Mapping Menu

### When It Appears

When you run: `deno task start map`

### Menu Display

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Field Mapping Menu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Add mapping
2. View mappings
3. Auto-map
4. Exit

Choose an option (1-4):
>
```

### Menu Options

#### Option 1: Add Mapping

**Prompts:**

1. **Select NocoDB Field**

```
Available NocoDB fields:
1. Project Name
2. Things UUID
3. Description
4. Category
5. Status

Select field to map (or type name):
>
```

**Input:** Number (1-5) or exact field name

2. **Select Things Property**

```
Things properties:
1. title (Project title/name)
2. id (Project UUID)
3. notes (Project notes/description)
4. area (Project area)
5. status (For bidirectional status sync)

Select property (1-5):
>
```

**Input:** Number (1-5)

**Confirmation:**

```
✓ Mapped: title → Project Name
```

#### Option 2: View Mappings

**Display:**

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

Press Enter to continue...
```

#### Option 3: Auto-Map

**Process:**

```
Auto-detecting field mappings...

Scanning NocoDB fields:
- Project Name → title ✓
- Things UUID → id ✓
- Description → notes ✓
- Category → area ✓
- Status → status ✓

Created 5 mappings

Press Enter to continue...
```

**Logic:**

- Matches common field name patterns
- Case-insensitive matching
- Looks for keywords like "title", "name", "uuid", "id", "notes", "description",
  etc.

#### Option 4: Exit

**Action:** Saves all mappings and exits to command line.

```
✓ Mappings saved

Next steps:
- Test sync: deno task start sync --dry-run
- Run sync: deno task start sync
```

---

## Debug Mode Confirmation

### When It Appears

During `--debug` mode, after each project is processed.

### Prompt Display

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Detailed debug output shown above]

Continue to next project? [y/n]:
>
```

### Response Options

| Input            | Action                     |
| ---------------- | -------------------------- |
| `y` or `<Enter>` | Continue to next project   |
| `n`              | Stop sync, exit debug mode |

**Note:** This prompt appears after every project in debug mode, allowing you to
step through projects one at a time.

---

## Tips for Using Prompts

### General Tips

1. **Read carefully** - Prompts show relevant context
2. **Default actions** - Pressing Enter often selects the safe/default option
3. **Cancel support** - Most prompts support Esc to cancel
4. **Case insensitive** - Option letters work in any case (c/C, f/F, etc.)

### Find & Select Tips

1. **Start broad** - Begin with short search terms
2. **Refine search** - Add more characters to narrow results
3. **Check ID numbers** - IDs shown in parentheses
4. **Use arrow keys** - More reliable than scrolling

### Configuration Tips

1. **Prepare info first** - Gather URL, token, and table ID before starting
2. **Copy-paste tokens** - Don't type long tokens manually
3. **Verify afterwards** - Use `config --show` to check

### Field Mapping Tips

1. **Use auto-map first** - Saves time on common mappings
2. **Add missing manually** - After auto-map, add any missed mappings
3. **View frequently** - Use option 2 to verify mappings visually
4. **Map UUID field** - Critical for reliable matching

---

## Related Documentation

- [Commands Reference](commands.md) - All commands and options
- [Getting Started](../tutorials/getting-started.md) - Initial setup tutorial
- [Configuration Reference](configuration.md) - Config file structure
