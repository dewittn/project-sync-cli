import { parseArgs } from "@std/cli/parse-args";
import { bold, green, yellow } from "@std/fmt/colors";
import { ConfigManager } from "../../config/manager.ts";

export async function mapCommand(
  args: string[],
  _globalFlags: Record<string, unknown>,
): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["help", "list", "reset", "auto"],
    string: ["add", "remove"],
    alias: {
      h: "help",
      l: "list",
      a: "add",
      r: "remove",
    },
  });

  if (flags.help) {
    printMapHelp();
    return;
  }

  const config = await ConfigManager.load();

  if (flags.list) {
    await listMappings(config);
    return;
  }

  if (flags.reset) {
    await resetMappings(config);
    return;
  }

  if (flags.add) {
    await addMapping(config, String(flags.add));
    return;
  }

  if (flags.remove) {
    await removeMapping(config, String(flags.remove));
    return;
  }

  if (flags.auto) {
    await autoGenerateMappings(config);
    return;
  }

  // Interactive mapping setup
  await interactiveMappingSetup(config);
}

async function listMappings(config: ConfigManager): Promise<void> {
  const mappings = config.get("fieldMappings") || {};

  console.log(bold("\nField Mappings"));
  console.log("─".repeat(50));

  if (Object.keys(mappings).length === 0) {
    console.log(yellow("No field mappings configured."));
    console.log("Run 'nocodb-things map' to set up mappings.");
    return;
  }

  console.log(bold("NocoDB Field → Things Property"));
  for (const [nocodbField, thingsProperty] of Object.entries(mappings)) {
    console.log(`  ${nocodbField} → ${thingsProperty}`);
  }

  // Show default mappings
  console.log(bold("\nDefault Mappings (built-in):"));
  console.log("  title → title");
  console.log("  notes → notes");
  console.log("  completed → completed");
  console.log("  due_date → when");
}

async function addMapping(
  config: ConfigManager,
  mapping: string,
): Promise<void> {
  const [nocodbField, thingsProperty] = mapping.split(":");

  if (!nocodbField || !thingsProperty) {
    console.log(
      yellow(
        "Invalid mapping format. Use: --add 'nocodb_field:things_property'",
      ),
    );
    return;
  }

  const mappings = config.get("fieldMappings") || {};
  mappings[nocodbField] = thingsProperty;

  config.set("fieldMappings", mappings);
  await config.save();

  console.log(green(`✓ Added mapping: ${nocodbField} → ${thingsProperty}`));
}

async function removeMapping(
  config: ConfigManager,
  nocodbField: string,
): Promise<void> {
  const mappings = config.get("fieldMappings") || {};

  if (!mappings[nocodbField]) {
    console.log(yellow(`No mapping found for field: ${nocodbField}`));
    return;
  }

  delete mappings[nocodbField];
  config.set("fieldMappings", mappings);
  await config.save();

  console.log(green(`✓ Removed mapping for: ${nocodbField}`));
}

async function resetMappings(config: ConfigManager): Promise<void> {
  const confirm = prompt(yellow("Reset all field mappings? (yes/no):"));

  if (confirm?.toLowerCase() === "yes") {
    config.set("fieldMappings", {});
    await config.save();
    console.log(green("✓ Field mappings reset successfully!"));
  } else {
    console.log("Reset cancelled.");
  }
}

async function autoGenerateMappings(config: ConfigManager): Promise<void> {
  console.log(bold("Auto-generating field mappings..."));

  // Common mapping patterns
  const commonMappings: Record<string, string> = {
    title: "title",
    name: "title",
    task: "title",
    description: "notes",
    notes: "notes",
    content: "notes",
    completed: "completed",
    done: "completed",
    status: "completed",
    due_date: "when",
    due: "when",
    deadline: "when",
    tags: "tags",
    project: "project",
    priority: "tags",
    checklist: "checklist-items",
  };

  const mappings: Record<string, string> = {};

  // TODO: Fetch actual fields from NocoDB table
  console.log(yellow("Note: Auto-mapping requires a configured NocoDB table."));
  console.log("Using common field patterns for now...");

  // For demonstration, use common patterns
  for (const [field, property] of Object.entries(commonMappings)) {
    mappings[field] = property;
  }

  config.set("fieldMappings", mappings);
  await config.save();

  console.log(green("✓ Auto-generated mappings saved!"));
  await listMappings(config);
}

async function interactiveMappingSetup(config: ConfigManager): Promise<void> {
  console.log(bold("Interactive Field Mapping Setup"));
  console.log("─".repeat(50));
  console.log("Map NocoDB fields to Things properties.");
  console.log("Press Enter to skip a field.\n");

  const thingsProperties = [
    "title",
    "notes",
    "when",
    "deadline",
    "tags",
    "checklist-items",
    "completed",
    "project",
    "area",
  ];

  const mappings = config.get("fieldMappings") || {};

  // TODO: Fetch actual fields from NocoDB
  const nocodbFields = [
    "title",
    "description",
    "due_date",
    "status",
    "priority",
    "tags",
    "project_id",
  ];

  console.log(bold("Available Things properties:"));
  console.log(thingsProperties.join(", "));
  console.log();

  for (const field of nocodbFields) {
    const currentMapping = mappings[field];
    const prompt_text = currentMapping
      ? `Map '${field}' to (current: ${currentMapping}):`
      : `Map '${field}' to:`;

    const input = prompt(prompt_text);

    if (input && thingsProperties.includes(input)) {
      mappings[field] = input;
      console.log(green(`  ✓ ${field} → ${input}`));
    } else if (input === "") {
      if (currentMapping) {
        console.log(`  Keeping: ${field} → ${currentMapping}`);
      } else {
        console.log(`  Skipping: ${field}`);
      }
    } else if (input) {
      console.log(yellow(`  Invalid property: ${input}`));
    }
  }

  config.set("fieldMappings", mappings);
  await config.save();

  console.log(green("\n✓ Field mappings saved successfully!"));
}

function printMapHelp(): void {
  console.log(`
${bold("MAP COMMAND")}
Setup field mappings between NocoDB and Things

${bold("USAGE:")}
  nocodb-things map [options]

${bold("OPTIONS:")}
  -h, --help              Show this help message
  -l, --list              List current field mappings
  -a, --add <mapping>     Add a field mapping (format: nocodb_field:things_property)
  -r, --remove <field>    Remove a field mapping
  --reset                 Reset all field mappings
  --auto                  Auto-generate mappings based on field names

${bold("THINGS PROPERTIES:")}
  title           Task title
  notes           Task notes/description
  when            When to do (today, evening, tomorrow, etc.)
  deadline        Hard deadline date
  tags            Task tags
  checklist-items Checklist items
  completed       Completion status
  project         Project assignment
  area            Area assignment

${bold("EXAMPLES:")}
  nocodb-things map                           # Interactive setup
  nocodb-things map --list                    # Show current mappings
  nocodb-things map --add "priority:tags"     # Add single mapping
  nocodb-things map --remove priority         # Remove mapping
  nocodb-things map --auto                    # Auto-generate mappings
`);
}
