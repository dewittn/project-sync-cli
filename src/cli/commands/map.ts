import { parseArgs } from "@std/cli/parse-args";
import { bold, cyan, green, red, yellow } from "@std/fmt/colors";
import { ConfigManager } from "../../config/manager.ts";
import { NocoDBClient } from "../../api/nocodb.ts";

// Valid Things project properties
const VALID_THINGS_PROPERTIES = [
  "title",
  "id",
  "notes",
  "area",
  "status",
] as const;

export async function mapCommand(
  args: string[],
  _globalFlags: Record<string, unknown>,
): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["help", "list", "reset", "auto", "clean"],
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

  if (flags.clean) {
    await cleanInvalidMappings(config);
    return;
  }

  // Interactive mapping setup
  await interactiveMappingSetup(config);
}

async function listMappings(config: ConfigManager): Promise<void> {
  // Get available NocoDB fields if configured
  let availableNocoDBFields: string[] = [];
  if (config.isConfigured()) {
    try {
      const nocodb = new NocoDBClient(config);
      const schema = await nocodb.getTableSchema();
      const columns = schema.columns as Array<{ title: string }>;
      availableNocoDBFields = columns.map((col) => col.title).sort();
    } catch (error) {
      console.log(
        yellow(
          `Warning: Could not fetch NocoDB table schema: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }

  const customMappings = config.get("fieldMappings") || {};

  // Default project field mappings
  const defaultMappings: Record<string, string> = {
    "Title": "title",
    "Project Name": "title",
    "Things UUID": "id",
    "Goal": "notes",
    "Area": "area",
  };

  console.log(
    bold("\n🗺️  Project Field Mapping (Sync Direction: Things → NocoDB)"),
  );
  console.log("─".repeat(70));
  console.log();

  // Separate valid and invalid custom mappings
  const validCustomMappings: Record<string, string> = {};
  const invalidMappings: Record<string, string> = {};

  for (const [field, value] of Object.entries(customMappings)) {
    if (
      VALID_THINGS_PROPERTIES.includes(
        value as typeof VALID_THINGS_PROPERTIES[number],
      )
    ) {
      validCustomMappings[field] = value;
    } else {
      invalidMappings[field] = value;
    }
  }

  // Use custom mappings if they exist, otherwise use defaults
  const effectiveMappings: Record<string, string> = {};

  // First add defaults
  for (const [field, value] of Object.entries(defaultMappings)) {
    effectiveMappings[field] = value;
  }

  // Override with valid custom mappings only (these take precedence)
  for (const [field, value] of Object.entries(validCustomMappings)) {
    effectiveMappings[field] = value;
  }

  // Group NocoDB fields by Things property
  const thingsToNocoDB: Record<string, string[]> = {};
  for (
    const [nocodbField, thingsProperty] of Object.entries(effectiveMappings)
  ) {
    if (!thingsToNocoDB[thingsProperty]) {
      thingsToNocoDB[thingsProperty] = [];
    }
    thingsToNocoDB[thingsProperty].push(nocodbField);
  }

  // Build dynamic visual representation
  console.log(bold("  Things Project Field    →    NocoDB Table Field"));
  console.log("  ┌──────────────────┐        ┌──────────────────┐");

  const thingsProperties = [
    { key: "title", label: "title (Project Title)" },
    { key: "id", label: "id (UUID)" },
    { key: "notes", label: "notes" },
    { key: "area", label: "area" },
    { key: "status", label: "status (NocoDB→Things)" },
  ];

  for (const prop of thingsProperties) {
    const nocodbFields = thingsToNocoDB[prop.key] || [];
    if (nocodbFields.length > 0) {
      const firstField = nocodbFields[0];
      console.log(
        `  │ ${prop.label.padEnd(16)} │ ────→ │ ${firstField.padEnd(16)} │`,
      );

      // Show additional mapped fields
      for (let i = 1; i < nocodbFields.length; i++) {
        console.log(
          `  │${" ".repeat(18)}│ ────→ │ ${nocodbFields[i].padEnd(16)} │`,
        );
      }
    } else {
      // Show unmapped Things properties
      console.log(
        `  │ ${prop.label.padEnd(16)} │ ────→ │ ${
          yellow("(not mapped)").padEnd(16)
        } │`,
      );
    }
  }

  console.log("  └──────────────────┘        └──────────────────┘");
  console.log();
  console.log("─".repeat(70));

  // Show configured mappings (reversed to show Things → NocoDB)
  console.log(bold("\nActive Mappings (Things → NocoDB):"));

  if (Object.keys(effectiveMappings).length === 0) {
    console.log(yellow("  No field mappings configured."));
    console.log("  Run 'prjsync map' to set up mappings.");
  } else {
    // Reverse the display to show Things property → NocoDB field
    for (const thingsProp of thingsProperties) {
      const nocodbFields = thingsToNocoDB[thingsProp.key] || [];
      if (nocodbFields.length > 0) {
        for (const nocodbField of nocodbFields) {
          const isCustom = validCustomMappings[nocodbField] !== undefined;
          const isDefault = !isCustom &&
            defaultMappings[nocodbField] === thingsProp.key;
          const marker = isCustom ? "(custom)" : isDefault ? "(default)" : "";
          const displayLabel = thingsProp.key === "title"
            ? "title (Project Title)"
            : thingsProp.key;
          console.log(
            `  Things.${displayLabel.padEnd(20)} → NocoDB.${
              nocodbField.padEnd(20)
            } ${marker ? green(marker) : ""}`,
          );
        }
      }
    }
  }

  // Show invalid mappings with warning
  if (Object.keys(invalidMappings).length > 0) {
    console.log(bold("\n⚠️  Invalid Mappings (ignored):"));
    console.log(
      yellow(
        "  The following mappings use invalid Things properties and will be ignored:",
      ),
    );
    for (
      const [nocodbField, thingsProperty] of Object.entries(invalidMappings)
    ) {
      console.log(
        `  Things.${red(thingsProperty.padEnd(10))} → NocoDB.${
          nocodbField.padEnd(20)
        } ${red("(invalid)")}`,
      );
    }
    console.log(
      yellow(
        `\n  Valid Things properties: ${VALID_THINGS_PROPERTIES.join(", ")}`,
      ),
    );
    console.log(
      yellow(
        "  Use 'prjsync map --remove <field>' to remove invalid mappings.",
      ),
    );
  }

  // Display available NocoDB fields if we fetched them
  if (availableNocoDBFields.length > 0) {
    console.log(bold("\n📋 Available NocoDB Table Fields:"));
    console.log(
      cyan(
        "  The following fields are available in your NocoDB table for mapping:",
      ),
    );

    // Group fields into mapped and unmapped
    const mappedFields = Object.keys(effectiveMappings);
    const unmappedFields = availableNocoDBFields.filter(
      (field) => !mappedFields.includes(field),
    );

    // Show mapped fields
    if (mappedFields.length > 0) {
      console.log(cyan("\n  Currently mapped:"));
      for (const field of mappedFields.sort()) {
        console.log(cyan(`    • ${field} ${green("✓")}`));
      }
    }

    // Show unmapped fields
    if (unmappedFields.length > 0) {
      console.log(cyan("\n  Available but not mapped:"));
      for (const field of unmappedFields.sort()) {
        console.log(cyan(`    • ${field}`));
      }
      console.log(
        cyan(
          '\n  Tip: Use "prjsync map --add <field>:<property>" to add mappings',
        ),
      );
    }
  }

  console.log();
  console.log(bold("ℹ️  Sync direction: Things → NocoDB (one-way)"));
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

  // Validate Things property
  if (
    !VALID_THINGS_PROPERTIES.includes(
      thingsProperty as typeof VALID_THINGS_PROPERTIES[number],
    )
  ) {
    console.log(
      red(
        `Invalid Things property: "${thingsProperty}". Valid properties are: ${
          VALID_THINGS_PROPERTIES.join(", ")
        }`,
      ),
    );
    return;
  }

  const mappings = config.get("fieldMappings") || {};

  // Check if another NocoDB field already maps to this Things property
  const existingMapping = Object.entries(mappings).find(
    ([nocoField, thingsProp]) =>
      thingsProp === thingsProperty && nocoField !== nocodbField,
  );

  if (existingMapping) {
    console.log(
      yellow(
        `Note: NocoDB field '${
          existingMapping[0]
        }' was already mapped to Things.${thingsProperty}`,
      ),
    );
    console.log(
      yellow(`Replacing with new mapping from '${nocodbField}'`),
    );
    // Remove the old mapping
    delete mappings[existingMapping[0]];
  }

  mappings[nocodbField] = thingsProperty;

  config.set("fieldMappings", mappings);
  await config.save();

  console.log(
    green(`✓ Added mapping: Things.${thingsProperty} → NocoDB.${nocodbField}`),
  );
  await listMappings(config);
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
  await listMappings(config);
}

async function resetMappings(config: ConfigManager): Promise<void> {
  const confirm = prompt(yellow("Reset all field mappings? (yes/no):"));

  if (confirm?.toLowerCase() === "yes") {
    config.set("fieldMappings", {});
    await config.save();
    console.log(green("✓ Field mappings reset successfully!"));
    await listMappings(config);
  } else {
    console.log("Reset cancelled.");
  }
}

async function autoGenerateMappings(config: ConfigManager): Promise<void> {
  console.log(bold("Auto-generating project field mappings..."));

  // Project-specific field mappings
  const projectMappings: Record<string, string> = {
    "Title": "title",
    "Project Name": "title",
    "project_name": "title",
    "Things UUID": "id",
    "things_uuid": "id",
    "UUID": "id",
    "Goal": "notes",
    "goal": "notes",
    "Notes": "notes",
    "notes": "notes",
    "Description": "notes",
    "Area": "area",
    "area": "area",
  };

  config.set("fieldMappings", projectMappings);
  await config.save();

  console.log(green("✓ Project field mappings generated!"));
  await listMappings(config);
}

async function interactiveMappingSetup(config: ConfigManager): Promise<void> {
  console.log(bold("Interactive Project Field Mapping Setup"));
  console.log("─".repeat(50));
  console.log(
    "Map Things project properties to NocoDB table fields (Things → NocoDB).",
  );
  console.log("Press Enter to skip a field.\n");

  const thingsProjectProperties = [
    { key: "title", label: "Project Title" },
    { key: "id", label: "Project UUID" },
    { key: "notes", label: "Project notes/goals" },
    { key: "area", label: "Project area" },
    {
      key: "status",
      label: "Project status (enables bidirectional sync NocoDB→Things)",
    },
  ];

  const mappings = config.get("fieldMappings") || {};

  // Query NocoDB to get the current list of fields
  let nocodbFields: string[] = [];
  if (config.isConfigured()) {
    try {
      console.log("Fetching NocoDB table fields...\n");
      const nocodb = new NocoDBClient(config);
      const schema = await nocodb.getTableSchema();
      const columns = schema.columns as Array<{ title: string }>;
      nocodbFields = columns.map((col) => col.title).sort();
      console.log(
        green(`✓ Found ${nocodbFields.length} fields in NocoDB table\n`),
      );
    } catch (error) {
      console.log(
        yellow(
          `Warning: Could not fetch NocoDB fields: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
      console.log(
        yellow("Using common field names as fallback.\n"),
      );
      // Fallback to common field names
      nocodbFields = [
        "Title",
        "Project Name",
        "Things UUID",
        "Goal",
        "Area",
        "Description",
        "Notes",
      ];
    }
  } else {
    console.log(
      yellow(
        "NocoDB not configured. Using common field names as examples.\n",
      ),
    );
    // Fallback to common field names
    nocodbFields = [
      "Title",
      "Project Name",
      "Things UUID",
      "Goal",
      "Area",
      "Description",
      "Notes",
    ];
  }

  console.log(bold("Available Things project properties:"));
  for (const prop of thingsProjectProperties) {
    console.log(`  • ${prop.key} (${prop.label})`);
  }
  console.log();

  for (const field of nocodbFields) {
    const currentMapping = mappings[field];
    const prompt_text = currentMapping
      ? `Which Things property should NocoDB field '${field}' map to? (current: ${currentMapping}):`
      : `Which Things property should NocoDB field '${field}' map to?`;

    const input = prompt(prompt_text);

    if (
      input && thingsProjectProperties.some((p) => p.key === input)
    ) {
      // Check if another NocoDB field already maps to this Things property
      const existingMapping = Object.entries(mappings).find(
        ([nocoField, thingsProp]) =>
          thingsProp === input && nocoField !== field,
      );

      if (existingMapping) {
        console.log(
          yellow(
            `  Note: NocoDB field '${
              existingMapping[0]
            }' was already mapped to Things.${input}`,
          ),
        );
        console.log(
          yellow(`  Replacing with new mapping from '${field}'`),
        );
        // Remove the old mapping
        delete mappings[existingMapping[0]];
      }

      mappings[field] = input;
      console.log(green(`  ✓ Things.${input} → NocoDB.${field}`));
    } else if (input === "") {
      if (currentMapping) {
        console.log(`  Keeping: Things.${currentMapping} → NocoDB.${field}`);
      } else {
        console.log(`  Skipping: ${field}`);
      }
    } else if (input) {
      console.log(yellow(`  Invalid property: ${input}`));
    }
  }

  config.set("fieldMappings", mappings);
  await config.save();

  console.log(green("\n✓ Project field mappings saved successfully!"));
  await listMappings(config);
}

async function cleanInvalidMappings(config: ConfigManager): Promise<void> {
  const mappings = config.get("fieldMappings") || {};
  const validMappings: Record<string, string> = {};
  const removedMappings: Record<string, string> = {};

  // Filter out invalid mappings
  for (const [field, value] of Object.entries(mappings)) {
    if (
      VALID_THINGS_PROPERTIES.includes(
        value as typeof VALID_THINGS_PROPERTIES[number],
      )
    ) {
      validMappings[field] = value;
    } else {
      removedMappings[field] = value;
    }
  }

  if (Object.keys(removedMappings).length === 0) {
    console.log(green("✓ No invalid mappings found. Config is clean!"));
    return;
  }

  console.log(bold("Removing invalid mappings:"));
  for (const [field, value] of Object.entries(removedMappings)) {
    console.log(red(`  - ${field} → ${value}`));
  }

  config.set("fieldMappings", validMappings);
  await config.save();

  console.log(
    green(
      `\n✓ Removed ${Object.keys(removedMappings).length} invalid mapping(s)!`,
    ),
  );
  await listMappings(config);
}

function printMapHelp(): void {
  console.log(`
${bold("MAP COMMAND")}
Setup project field mappings for Things to NocoDB sync

${bold("USAGE:")}
  prjsync map [options]

${bold("OPTIONS:")}
  -h, --help              Show this help message
  -l, --list              Display field mappings with visual diagram
  -a, --add <mapping>     Add a field mapping (format: nocodb_field:things_property)
  -r, --remove <field>    Remove a field mapping
  --reset                 Reset all field mappings to defaults
  --auto                  Auto-generate project mappings
  --clean                 Remove invalid mappings from config

${bold("THINGS PROJECT PROPERTIES:")}
  title           Project Title
  id              Project unique identifier (UUID)
  notes           Project notes/goals
  area            Project area
  status          Project status (enables bidirectional sync: NocoDB Status → Things Tags)

${bold("DEFAULT NOCODB FIELDS:")}
  Title           Maps to project title (Project Title)
  Project Name    Maps to project title (Project Title)
  Things UUID     Maps to project id (UUID)
  Goal            Maps to project notes
  Area            Maps to project area

${bold("EXAMPLES:")}
  prjsync map                           # Interactive setup
  prjsync map --list                    # Show visual field mapping
  prjsync map --add "Goal:notes"        # Map Goal field to notes
  prjsync map --remove Goal             # Remove Goal mapping
  prjsync map --auto                    # Auto-generate mappings

${bold("NOTES:")}
  - Only one NocoDB field can be mapped to each Things property
  - New mappings replace existing ones for the same Things property
  - The CLI fetches current NocoDB fields during interactive setup
  - Mapping a field to 'status' enables bidirectional status sync (NocoDB → Things tags)
  - Status field should be a single-select field in NocoDB for best results
`);
}
