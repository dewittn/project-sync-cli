import { parseArgs } from "@std/cli/parse-args";
import { bold, green, red, yellow } from "@std/fmt/colors";
import { ThingsClient } from "../../api/things.ts";

export async function listProjectsCommand(
  commandArgs: string[],
  globalArgs: Record<string, unknown>,
): Promise<void> {
  const args = parseArgs(commandArgs, {
    boolean: ["help"],
    alias: {
      h: "help",
    },
  });

  if (args.help) {
    console.log(`
${bold("list-projects")} - List all projects found in Things

${bold("USAGE:")}
  nocodb-things list-projects [options]

${bold("OPTIONS:")}
  -h, --help        Show this help message

${bold("DESCRIPTION:")}
  This command connects to Things 3 and retrieves a list of all projects.
  It uses AppleScript to query Things 3 directly.

${bold("EXAMPLES:")}
  nocodb-things list-projects          # List all projects
`);
    return;
  }

  try {
    console.log(yellow("🔍 Fetching projects from Things..."));

    const thingsClient = new ThingsClient();

    // Test connection first
    const connectionTest = await thingsClient.testConnection();
    if (!connectionTest.success) {
      throw new Error(`Cannot connect to Things: ${connectionTest.error}`);
    }

    // Get projects
    const projects = await thingsClient.getProjects();

    if (projects.length === 0) {
      console.log(yellow("📝 No projects found in Things"));
      return;
    }

    console.log(green(`\n✅ Found ${projects.length} project${projects.length === 1 ? '' : 's'}:\n`));

    projects.forEach((project, index) => {
      console.log(`${(index + 1).toString().padStart(3)}. ${project}`);
    });

    console.log();
  } catch (error) {
    console.error(red(`❌ Error fetching projects: ${error.message}`));
    if (globalArgs.verbose) {
      console.error(error);
    }
    Deno.exit(1);
  }
}