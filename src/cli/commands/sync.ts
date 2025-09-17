import { parseArgs } from "@std/cli/parse-args";
import { bold, green, yellow } from "@std/fmt/colors";
import { SyncEngine } from "../../sync/engine.ts";
import { ConfigManager } from "../../config/manager.ts";

export async function syncCommand(
  args: string[],
  globalFlags: Record<string, unknown>,
): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["help", "full", "dry-run", "force"],
    string: ["direction", "filter"],
    alias: {
      h: "help",
      f: "full",
      d: "direction",
    },
  });

  if (flags.help) {
    printSyncHelp();
    return;
  }

  const config = await ConfigManager.load();
  if (!config.isConfigured()) {
    console.log(
      yellow(
        "Configuration not found. Please run 'nocodb-things config --set' first.",
      ),
    );
    Deno.exit(1);
  }

  const engine = new SyncEngine(config);

  console.log(bold("Starting synchronization..."));

  const options = {
    full: flags.full || false,
    dryRun: flags["dry-run"] || false,
    force: flags.force || false,
    direction: flags.direction as "push" | "pull" | "sync" || "sync",
    filter: flags.filter,
    verbose: globalFlags.verbose as boolean || false,
  };

  try {
    const result = await engine.sync(options);

    console.log(green(bold("✓ Sync completed successfully!")));
    console.log(`  Items synced: ${result.itemsSynced}`);
    console.log(`  Items created: ${result.created}`);
    console.log(`  Items updated: ${result.updated}`);
    console.log(`  Items deleted: ${result.deleted}`);
    if (result.conflicts > 0) {
      console.log(yellow(`  Conflicts resolved: ${result.conflicts}`));
    }
    if (result.errors > 0) {
      console.log(yellow(`  Errors: ${result.errors}`));
    }
  } catch (error) {
    throw new Error(`Sync failed: ${error.message}`);
  }
}

function printSyncHelp(): void {
  console.log(`
${bold("SYNC COMMAND")}
Synchronize data between NocoDB and Things

${bold("USAGE:")}
  nocodb-things sync [options]

${bold("OPTIONS:")}
  -h, --help              Show this help message
  -f, --full              Force full synchronization (ignore timestamps)
  -d, --direction <dir>   Sync direction: push, pull, or sync (default: sync)
  --dry-run               Preview changes without applying them
  --force                 Force sync even if conflicts are detected
  --filter <query>        Filter items to sync (e.g., "project:Work")

${bold("EXAMPLES:")}
  nocodb-things sync                          # Two-way sync
  nocodb-things sync --full                   # Full re-sync
  nocodb-things sync --direction push         # Push to NocoDB only
  nocodb-things sync --dry-run                # Preview changes
  nocodb-things sync --filter "tag:important" # Sync only tagged items
`);
}
