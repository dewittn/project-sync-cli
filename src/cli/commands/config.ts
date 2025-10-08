import { parseArgs } from "@std/cli/parse-args";
import { bold, green, yellow } from "@std/fmt/colors";
import { ConfigManager } from "../../config/manager.ts";

export async function configCommand(
  args: string[],
  _globalFlags: Record<string, unknown>,
): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["help", "set", "show", "reset"],
    string: [
      "nocodb-url",
      "nocodb-token",
      "base-name",
      "base-id",
      "table-name",
      "table-id",
    ],
    alias: {
      h: "help",
      s: "set",
    },
  });

  if (flags.help) {
    printConfigHelp();
    return;
  }

  const config = await ConfigManager.load();

  if (flags.show) {
    showConfig(config);
    return;
  }

  if (flags.reset) {
    await resetConfig(config);
    return;
  }

  if (
    flags.set || flags["nocodb-url"] || flags["nocodb-token"] ||
    flags["base-name"] || flags["base-id"] || flags["table-name"] ||
    flags["table-id"]
  ) {
    await setConfig(config, flags);
    return;
  }

  printConfigHelp();
}

function showConfig(config: ConfigManager): void {
  const currentConfig = config.getAll();

  console.log(bold("\nCurrent Configuration:"));
  console.log("─".repeat(50));

  if (currentConfig.nocodbUrl) {
    console.log(`NocoDB URL:        ${currentConfig.nocodbUrl}`);
    console.log(
      `NocoDB Token:      ${
        currentConfig.nocodbToken
          ? "***" + currentConfig.nocodbToken.slice(-4)
          : "Not set"
      }`,
    );
    console.log();
    console.log(
      `Base Name:         ${currentConfig.projectName || "Not set"}`,
    );
    console.log(`Base ID:           ${currentConfig.baseId || "Not set"}`);
    console.log(`Table Name:        ${currentConfig.tableName || "Not set"}`);
    console.log(`Table ID:          ${currentConfig.tableId || "Not set"}`);
  } else {
    console.log(yellow("No configuration found."));
  }

  console.log("\nField Mappings:");
  const mappingCount = currentConfig.fieldMappings
    ? Object.keys(currentConfig.fieldMappings).length
    : 0;
  if (mappingCount > 0) {
    console.log(
      `  ${mappingCount} mapping(s) configured. Use 'map --list' to view.`,
    );
  } else {
    console.log("  No field mappings configured. Use 'map' to configure.");
  }
}

async function setConfig(
  config: ConfigManager,
  flags: Record<string, unknown>,
): Promise<void> {
  console.log(bold("Configure prjsync\n"));

  if (flags["nocodb-url"]) {
    config.set("nocodbUrl", String(flags["nocodb-url"]));
  } else if (flags.set) {
    const url = prompt("NocoDB API URL:");
    if (url) config.set("nocodbUrl", url);
  }

  if (flags["nocodb-token"]) {
    config.set("nocodbToken", String(flags["nocodb-token"]));
  } else if (flags.set) {
    const token = prompt("NocoDB API Token:");
    if (token) config.set("nocodbToken", token);
  }

  if (flags["base-name"]) {
    config.set("projectName", String(flags["base-name"]));
  } else if (flags.set) {
    const baseName = prompt(
      "NocoDB Base Name (the workspace/database containing your table):",
    );
    if (baseName) config.set("projectName", baseName);
  }

  if (flags["base-id"]) {
    config.set("baseId", String(flags["base-id"]));
  } else if (flags.set) {
    const baseId = prompt(
      "NocoDB Base ID (optional, leave empty to auto-detect):",
    );
    if (baseId) config.set("baseId", baseId);
  }

  if (flags["table-name"]) {
    config.set("tableName", String(flags["table-name"]));
  } else if (flags.set) {
    const tableName = prompt("NocoDB Table Name:");
    if (tableName) config.set("tableName", tableName);
  }

  if (flags["table-id"]) {
    config.set("tableId", String(flags["table-id"]));
  } else if (flags.set) {
    const tableId = prompt(
      "NocoDB Table ID (optional, leave empty to auto-detect):",
    );
    if (tableId) config.set("tableId", tableId);
  }

  await config.save();
  console.log(green("\n✓ Configuration saved successfully!"));
}

async function resetConfig(config: ConfigManager): Promise<void> {
  const confirm = prompt(
    yellow("Are you sure you want to reset all configuration? (yes/no):"),
  );

  if (confirm?.toLowerCase() === "yes") {
    await config.reset();
    console.log(green("✓ Configuration reset successfully!"));
  } else {
    console.log("Reset cancelled.");
  }
}

function printConfigHelp(): void {
  console.log(`
${bold("CONFIG COMMAND")}
Configure NocoDB connection and sync settings

${bold("USAGE:")}
  prjsync config [options]

${bold("OPTIONS:")}
  -h, --help              Show this help message
  -s, --set               Interactive configuration setup
  --show                  Display current configuration
  --reset                 Reset all configuration

${bold("CONNECTION OPTIONS:")}
  --nocodb-url <url>      Set NocoDB API URL (e.g., https://app.nocodb.com)
  --nocodb-token <token>  Set NocoDB API authentication token

${bold("TARGET OPTIONS:")}
  --base-name <name>      Set NocoDB Base name (workspace/database)
  --base-id <id>          Set NocoDB Base ID (optional, auto-detected)
  --table-name <name>     Set NocoDB Table name
  --table-id <id>         Set NocoDB Table ID (optional, auto-detected)

${bold("NOTES:")}
  • A NocoDB "Base" is a workspace/database that contains tables
  • Base ID and Table ID can be auto-detected from their names
  • Use --show to view current configuration including IDs
  • Field mappings are managed with the 'map' command

${bold("EXAMPLES:")}
  prjsync config --set                              # Interactive setup
  prjsync config --show                             # View config
  prjsync config --base-name "My Workspace"         # Set base name
  prjsync config --table-id "mo2x03mdukvj9ap"       # Set table ID
  prjsync config --reset                            # Reset all
`);
}
