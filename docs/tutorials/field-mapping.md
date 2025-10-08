# Field Mapping Tutorial

This tutorial walks you through the process of setting up field mappings between Things 3 projects and your NocoDB table. By the end, you'll understand how to create effective mappings for any NocoDB schema.

## What is Field Mapping?

Field mapping tells prjsync which NocoDB fields correspond to which Things project properties. Without proper mappings, prjsync won't know where to store your project data.

### Things Project Properties

Every Things project has these properties:

| Property | Description | Example |
|----------|-------------|---------|
| `title` | Project name | "Launch New Website" |
| `id` | Unique identifier (UUID) | "ABC123-DEF456-GHI789" |
| `notes` | Project description | "Build and deploy the new company website" |
| `area` | Project area (if assigned) | "Work", "Personal", etc. |
| `status` | For bidirectional sync (optional) | Not directly readable from Things |

## Tutorial: Mapping Your First Table

Let's walk through setting up mappings for a typical NocoDB project table.

### Step 1: Examine Your NocoDB Table

Before starting, look at your NocoDB table and note the field names. For this tutorial, let's assume you have a table with these fields:

- **Project Name** (Single Line Text)
- **Things UUID** (Single Line Text)
- **Description** (Long Text)
- **Category** (Single Line Text)
- **Status** (Single Select: To Do, In Progress, Review, Done)

### Step 2: Start the Mapping Command

Run the field mapping command:

```bash
deno task start map
```

You'll see a menu:

```
Field Mapping Menu:
1. Add mapping
2. View mappings
3. Auto-map
4. Exit

Choose an option:
```

### Step 3: Try Auto-Mapping First

Auto-mapping can save time by detecting common field names. Choose option `3`:

```
Choose an option: 3
```

prjsync will scan your NocoDB table and look for fields with common names. In our example, it might create these mappings automatically:

```
Auto-detected mappings:
✓ title → Project Name
✓ notes → Description

2 mappings created
```

### Step 4: Add Remaining Mappings

Auto-mapping didn't find all the fields we need. Let's add the missing ones manually. Choose option `1`:

```
Choose an option: 1
```

#### Mapping the UUID Field

First, let's map the UUID field (this is critical for tracking synced projects):

```
Available NocoDB fields:
1. Project Name
2. Things UUID
3. Description
4. Category
5. Status

Select field to map (or type name): 2
```

Now select which Things property to map it to:

```
Things properties:
1. title
2. id (UUID)
3. notes
4. area
5. status

Select property: 2
```

Perfect! The UUID field is now mapped:

```
✓ Mapped: id → Things UUID
```

#### Mapping the Area/Category Field

Let's map the Category field to the Things area property:

Choose option `1` again:

```
Select field to map: 4  (Category)
```

```
Select property: 4  (area)
```

```
✓ Mapped: area → Category
```

### Step 5: Add Status Mapping (Optional)

If you want bidirectional status synchronization, map your Status field:

Choose option `1` again:

```
Select field to map: 5  (Status)
```

```
Select property: 5  (status)
```

```
✓ Mapped: status → Status
✓ Status sync enabled
```

### Step 6: View Your Mappings

Let's verify everything looks correct. Choose option `2`:

```
Choose an option: 2
```

You'll see a visual diagram:

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
```

Perfect! All the required fields are mapped.

### Step 7: Exit and Save

Choose option `4` to save your mappings and exit:

```
Choose an option: 4
```

Your mappings are now saved to `~/.prjsync/config.json`.

## Advanced Mapping Scenarios

### Scenario 1: Table Without a Dedicated UUID Field

If your NocoDB table doesn't have a dedicated UUID field, you have two options:

**Option A: Add a UUID field to your table**
1. In NocoDB, add a new field called "Things UUID" (Single Line Text)
2. Map it to the `id` property in prjsync

**Option B: Use title matching only**
- Don't map the `id` property
- prjsync will match projects by title only
- ⚠️ Warning: Less reliable if project names change or aren't unique

### Scenario 2: Multiple Description Fields

If you have multiple text fields in NocoDB (Goals, Description, Notes), choose the one that best fits your workflow:

```
# Map to the primary description field
notes → Goals
```

The other fields can be managed manually in NocoDB or ignored by prjsync.

### Scenario 3: Not Using Areas in Things

If you don't use Areas in Things, simply don't map the `area` property. prjsync will skip it during sync.

### Scenario 4: Remapping Fields

If you made a mistake or want to change a mapping:

1. Run `deno task start map`
2. The interactive menu doesn't have a "remove" option yet
3. Edit `~/.prjsync/config.json` manually and remove the mapping from the `fieldMappings` section
4. Run `deno task start map` again to add the correct mapping

## Testing Your Mappings

After setting up mappings, test them with a dry-run:

```bash
deno task start sync --dry-run
```

This shows you exactly what data would be synced to which fields without making actual changes.

For detailed output showing the field mappings in action:

```bash
deno task start sync --dry-run --verbose
```

## Common Mapping Mistakes

### Mistake 1: Mapping Multiple Things Properties to the Same Field

**Wrong:**
```
title → Project Name
notes → Project Name
```

Each NocoDB field can only be mapped to one Things property. The second mapping will overwrite the first.

### Mistake 2: Not Mapping the UUID Field

Without a UUID mapping, prjsync can only match projects by title. This is less reliable and can cause duplicates if project names change.

**Always map the `id` property to a dedicated UUID field in NocoDB.**

### Mistake 3: Using the Wrong Field Type for UUID

The NocoDB field for storing UUIDs should be:
- **Single Line Text** ✓
- Not Long Text, Number, or any other type

### Mistake 4: Case Sensitivity Issues

NocoDB field names are case-sensitive. "Project Name" and "project name" are different fields. Make sure you're selecting the exact field name.

## Next Steps

Now that you've set up field mappings, you're ready to:

- **[Perform your first sync](getting-started.md#step-7-your-first-sync-dry-run)** - Sync your projects
- **[Set up status synchronization](../how-to/status-sync.md)** - Learn more about bidirectional status sync
- **[Explore sync options](../how-to/sync-projects.md)** - Different ways to sync your projects

## Quick Reference

### Command Options

```bash
# Interactive mapping menu
deno task start map

# View mappings only (non-interactive)
deno task start map --list

# Add a specific mapping (non-interactive)
deno task start map --add "Things UUID:id"

# Auto-detect and create mappings (non-interactive)
deno task start map --auto
```

### Mapping Syntax

When using `--add`, the syntax is:

```
"NocoDB Field Name:things_property"
```

Examples:
```bash
deno task start map --add "Project Name:title"
deno task start map --add "Things UUID:id"
deno task start map --add "Description:notes"
deno task start map --add "Category:area"
deno task start map --add "Status:status"
```

---

Need help? Check the [Troubleshooting Guide](../how-to/troubleshooting.md) for common issues.
