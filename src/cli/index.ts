#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env --allow-run

import { parseArgs } from "@std/cli/parse-args";
import { bold, red } from "@std/fmt/colors";
import { configCommand } from "./commands/config.ts";
import { statusCommand } from "./commands/status.ts";
import { testCommand } from "./commands/test.ts";
import { mapCommand } from "./commands/map.ts";
import { projectSyncCommand } from "./commands/project-sync.ts";
import { listProjectsCommand } from "./commands/list-projects.ts";

const VERSION = "0.2.0";

function printHelp(): void {
  console.log(`
${bold("NocoDB-Things Project Sync")} v${VERSION}

${bold("USAGE:")}
  nocodb-things [command] [options]

${bold("COMMANDS:")}
  sync              Synchronize Things projects to NocoDB (default)
  list-projects     List all projects found in Things
  map               Setup field mappings for project synchronization
  config            Configure sync settings
  status            Show current sync status
  test              Test connections to NocoDB and Things

${bold("GLOBAL OPTIONS:")}
  -h, --help        Show this help message
  -v, --version     Show version information
  --verbose         Enable verbose logging

${bold("EXAMPLES:")}
  nocodb-things                         # Sync projects (default action)
  nocodb-things sync                    # Sync Things projects to NocoDB
  nocodb-things list-projects           # List all Things projects
  nocodb-things map                     # Configure project field mappings
  nocodb-things config --set            # Interactive configuration setup
  nocodb-things test                    # Test API connections

For more information on a specific command, use:
  nocodb-things <command> --help
`);
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    boolean: ["help", "version", "verbose"],
    alias: {
      h: "help",
      v: "version",
    },
    stopEarly: true,
    unknown: (arg) => {
      if (arg.startsWith("-")) {
        console.error(red(`Unknown option: ${arg}`));
        console.log(`Run 'nocodb-things --help' for usage information.`);
        Deno.exit(1);
      }
      return true;
    },
  });

  if (args.version) {
    console.log(`nocodb-things v${VERSION}`);
    Deno.exit(0);
  }

  if (args.help) {
    printHelp();
    Deno.exit(0);
  }

  // Default to 'sync' command if no command provided
  const command = args._.length === 0 ? "sync" : String(args._[0]);
  const commandArgs = args._.length === 0 ? [] : args._.slice(1).map(String);

  try {
    switch (command) {
      case "sync":
      case "project-sync": // Keep for backwards compatibility
        await projectSyncCommand(commandArgs, args);
        break;
      case "list-projects":
        await listProjectsCommand(commandArgs, args);
        break;
      case "config":
        await configCommand(commandArgs, args);
        break;
      case "status":
        await statusCommand(commandArgs, args);
        break;
      case "test":
        await testCommand(commandArgs, args);
        break;
      case "map":
        await mapCommand(commandArgs, args);
        break;
      default:
        console.error(red(`Unknown command: ${command}`));
        console.log(`Run 'nocodb-things --help' for usage information.`);
        Deno.exit(1);
    }
  } catch (error) {
    console.error(
      red(`Error: ${error instanceof Error ? error.message : String(error)}`),
    );
    if (args.verbose) {
      console.error(error);
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
