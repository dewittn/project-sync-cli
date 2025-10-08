import { parseArgs } from "@std/cli/parse-args";
import { bold, green, red, yellow } from "@std/fmt/colors";
import { ConfigManager } from "../../config/manager.ts";
import { StateManager } from "../../utils/state.ts";

export async function statusCommand(
  args: string[],
  _globalFlags: Record<string, unknown>,
): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["help", "detailed"],
    alias: {
      h: "help",
      d: "detailed",
    },
  });

  if (flags.help) {
    printStatusHelp();
    return;
  }

  const config = await ConfigManager.load();
  const state = await StateManager.load();

  console.log(bold("\nprjsync - Sync Status"));
  console.log("─".repeat(50));

  // Configuration Status
  console.log(bold("\n📋 Configuration:"));
  if (config.isConfigured()) {
    console.log(green("  ✓ Configured"));
    const cfg = config.getAll();
    if (cfg.nocodbUrl) {
      console.log(`  • NocoDB URL: ${cfg.nocodbUrl}`);
      console.log(`  • Table ID: ${cfg.tableId || yellow("Not set")}`);
    }
  } else {
    console.log(red("  ✗ Not configured"));
    console.log(yellow("  Run 'prjsync config --set' to configure"));
  }

  // Last Sync Status
  console.log(bold("\n🔄 Last Sync:"));
  const lastSync = state.getLastSync();
  if (lastSync) {
    console.log(
      `  • Timestamp: ${new Date(lastSync.timestamp).toLocaleString()}`,
    );
    console.log(`  • Direction: ${lastSync.direction}`);
    console.log(`  • Items synced: ${lastSync.itemsSynced}`);
    console.log(`  • Duration: ${lastSync.duration}ms`);

    if (lastSync.errors && lastSync.errors.length > 0) {
      console.log(yellow(`  • Errors: ${lastSync.errors.length}`));
      if (flags.detailed) {
        lastSync.errors.forEach((error: string) => {
          console.log(`    - ${error}`);
        });
      }
    } else {
      console.log(green("  • No errors"));
    }
  } else {
    console.log(yellow("  No sync history"));
  }

  // Connection Status
  if (flags.detailed) {
    console.log(bold("\n🔌 Connection Status:"));

    try {
      // Test NocoDB connection
      const nocodbStatus = await testNocoDBConnection(config);
      if (nocodbStatus.success) {
        console.log(green("  ✓ NocoDB: Connected"));
        console.log(`    Tables: ${nocodbStatus.tableCount}`);
      } else {
        console.log(red("  ✗ NocoDB: Failed"));
        console.log(`    Error: ${nocodbStatus.error}`);
      }
    } catch (error) {
      console.log(red("  ✗ NocoDB: Failed"));
      console.log(
        `    Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Test Things availability
    const thingsStatus = await testThingsConnection();
    if (thingsStatus.success) {
      console.log(green("  ✓ Things: Available"));
    } else {
      console.log(yellow("  ⚠ Things: Not detected"));
      console.log("    Make sure Things.app is installed");
    }
  }

  // Sync Statistics
  console.log(bold("\n📊 Statistics:"));
  const stats = state.getStatistics();
  console.log(`  • Total syncs: ${stats.totalSyncs}`);
  console.log(`  • Successful: ${stats.successfulSyncs}`);
  console.log(`  • Failed: ${stats.failedSyncs}`);
  console.log(`  • Total items synced: ${stats.totalItemsSynced}`);

  if (!flags.detailed) {
    console.log(yellow("\nRun with --detailed for more information"));
  }
}

async function testNocoDBConnection(
  config: ConfigManager,
): Promise<{ success: boolean; tableCount?: number; error?: string }> {
  const cfg = config.getAll();
  if (!cfg.nocodbUrl || !cfg.nocodbToken) {
    return { success: false, error: "Not configured" };
  }

  try {
    const response = await fetch(`${cfg.nocodbUrl}/api/v1/db/meta/projects`, {
      headers: {
        "xc-token": cfg.nocodbToken,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, tableCount: data.list?.length || 0 };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testThingsConnection(): Promise<{ success: boolean }> {
  try {
    // Check if Things.app exists
    const command = new Deno.Command("osascript", {
      args: [
        "-e",
        'tell application "System Events" to return exists application process "Things3"',
      ],
    });

    const { stdout } = await command.output();
    const output = new TextDecoder().decode(stdout).trim();

    return { success: output === "true" };
  } catch {
    return { success: false };
  }
}

function printStatusHelp(): void {
  console.log(`
${bold("STATUS COMMAND")}
Show current sync status and statistics

${bold("USAGE:")}
  prjsync status [options]

${bold("OPTIONS:")}
  -h, --help       Show this help message
  -d, --detailed   Show detailed status information

${bold("EXAMPLES:")}
  prjsync status              # Basic status
  prjsync status --detailed   # Detailed status with connections
`);
}
