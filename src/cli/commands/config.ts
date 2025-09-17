import { parseArgs } from "@std/cli/parse-args";
import { bold, green, yellow } from "@std/fmt/colors";
import { ConfigManager } from "../../config/manager.ts";

export async function configCommand(
  args: string[],
  _globalFlags: Record<string, unknown>,
): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["help", "set", "show", "reset"],
    string: ["nocodb-url", "nocodb-token", "project-name", "table-name"],
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
    await showConfig(config);
    return;
  }

  if (flags.reset) {
    await resetConfig(config);
    return;
  }

  if (
    flags.set || flags["nocodb-url"] || flags["nocodb-token"] ||
    flags["project-name"] || flags["table-name"]
  ) {
    await setConfig(config, flags);
    return;
  }

  printConfigHelp();
}

async function showConfig(config: ConfigManager): Promise<void> {
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
    console.log(`Project Name:      ${currentConfig.projectName || "Not set"}`);
    console.log(`Table Name:        ${currentConfig.tableName || "Not set"}`);
  } else {
    console.log(yellow("No configuration found."));
  }

  console.log("\nSync Settings:");
  console.log(`  Direction:       ${currentConfig.syncDirection || "sync"}`);
  console.log(`  Auto-sync:       ${currentConfig.autoSync || false}`);
  console.log(
    `  Interval:        ${currentConfig.syncInterval || 300} seconds`,
  );

  console.log("\nField Mappings:");
  if (
    currentConfig.fieldMappings &&
    Object.keys(currentConfig.fieldMappings).length > 0
  ) {
    for (
      const [nocodbField, thingsField] of Object.entries(
        currentConfig.fieldMappings,
      )
    ) {
      console.log(`  ${nocodbField} → ${thingsField}`);
    }
  } else {
    console.log("  No field mappings configured");
  }
}

async function setConfig(
  config: ConfigManager,
  flags: Record<string, unknown>,
): Promise<void> {
  console.log(bold("Configure NocoDB-Things Sync\n"));

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

  if (flags["project-name"]) {
    config.set("projectName", String(flags["project-name"]));
  } else if (flags.set) {
    const projectName = prompt("NocoDB Project Name:");
    if (projectName) config.set("projectName", projectName);
  }

  if (flags["table-name"]) {
    config.set("tableName", String(flags["table-name"]));
  } else if (flags.set) {
    const tableName = prompt("NocoDB Table Name:");
    if (tableName) config.set("tableName", tableName);
  }

  if (flags.set) {
    const direction = prompt("Sync direction (push/pull/sync) [sync]:");
    if (direction && ["push", "pull", "sync"].includes(direction)) {
      config.set("syncDirection", direction);
    }
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
Configure sync settings for NocoDB and Things

${bold("USAGE:")}
  nocodb-things config [options]

${bold("OPTIONS:")}
  -h, --help              Show this help message
  -s, --set               Interactive configuration setup
  --show                  Display current configuration
  --reset                 Reset all configuration
  --nocodb-url <url>      Set NocoDB API URL
  --nocodb-token <token>  Set NocoDB API token
  --project-name <name>   Set NocoDB project name
  --table-name <name>     Set NocoDB table name

${bold("EXAMPLES:")}
  nocodb-things config --set                          # Interactive setup
  nocodb-things config --show                         # View current config
  nocodb-things config --nocodb-url https://api.example.com
  nocodb-things config --reset                        # Reset all settings
`);
}
