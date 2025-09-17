import { parseArgs } from "@std/cli/parse-args";
import { bold, green, red, yellow, cyan, dim } from "@std/fmt/colors";
import { ThingsClient, ProjectDetails } from "../../api/things.ts";

export async function listProjectsCommand(
  commandArgs: string[],
  globalArgs: Record<string, unknown>,
): Promise<void> {
  const args = parseArgs(commandArgs, {
    boolean: ["help"],
    string: ["details", "project"],
    alias: {
      h: "help",
      d: "details",
      p: "project",
    },
  });

  if (args.help) {
    console.log(`
${bold("list-projects")} - List all projects found in Things

${bold("USAGE:")}
  nocodb-things list-projects [options]

${bold("OPTIONS:")}
  -h, --help                Show this help message
  -d, --details <number>    Show detailed info for project by number (from list)
  -p, --project <name>      Show detailed info for project by exact name

${bold("DESCRIPTION:")}
  This command connects to Things 3 and retrieves a list of all projects.
  It uses AppleScript to query Things 3 directly. You can also get detailed
  information about specific projects including area, notes, UUID, and deadline.

${bold("EXAMPLES:")}
  nocodb-things list-projects              # List all projects
  nocodb-things list-projects -d 5         # Show details for project #5
  nocodb-things list-projects -p "My Project"  # Show details for "My Project"
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

    // Handle specific project details request
    if (args.details || args.project) {
      let projectName: string;

      if (args.details) {
        const projectIndex = parseInt(args.details) - 1;
        if (projectIndex < 0 || projectIndex >= projects.length) {
          console.error(red(`❌ Invalid project number. Please choose between 1 and ${projects.length}`));
          Deno.exit(1);
        }
        projectName = projects[projectIndex];
      } else {
        projectName = args.project;
      }

      console.log(yellow(`\n🔍 Fetching details for project: ${bold(projectName)}`));

      const projectDetails = await thingsClient.getProjectDetails(projectName);

      if (!projectDetails) {
        console.error(red(`❌ Project "${projectName}" not found`));
        Deno.exit(1);
      }

      displayProjectDetails(projectDetails);
      return;
    }

    // Display all projects list
    console.log(green(`\n✅ Found ${projects.length} project${projects.length === 1 ? '' : 's'}:\n`));

    projects.forEach((project, index) => {
      console.log(`${(index + 1).toString().padStart(3)}. ${project}`);
    });

    console.log(dim(`\n💡 Use ${bold('--details <number>')} or ${bold('--project <name>')} to get detailed information about a specific project\n`));
  } catch (error) {
    console.error(red(`❌ Error fetching projects: ${error.message}`));
    if (globalArgs.verbose) {
      console.error(error);
    }
    Deno.exit(1);
  }
}

function displayProjectDetails(details: ProjectDetails): void {
  console.log(green(`\n✅ Project Details:\n`));

  console.log(`${bold('Title:')}     ${details.title}`);
  console.log(`${bold('UUID:')}      ${cyan(details.uuid)}`);

  if (details.area) {
    console.log(`${bold('Area:')}      ${details.area}`);
  } else {
    console.log(`${bold('Area:')}      ${dim('(none)')}`);
  }

  if (details.deadline) {
    console.log(`${bold('Deadline:')}  ${yellow(details.deadline)}`);
  } else {
    console.log(`${bold('Deadline:')}  ${dim('(none)')}`);
  }

  if (details.notes) {
    console.log(`${bold('Notes:')}\n${details.notes}`);
  } else {
    console.log(`${bold('Notes:')}     ${dim('(none)')}`);
  }

  console.log();
}