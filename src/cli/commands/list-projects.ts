import { parseArgs } from "@std/cli/parse-args";
import { bold, cyan, dim, green, red, yellow } from "@std/fmt/colors";
import { ProjectDetails, ThingsClient } from "../../api/things.ts";

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
  prjsync list-projects [options]

${bold("OPTIONS:")}
  -h, --help                Show this help message
  -d, --details <number>    Show detailed info for project by number (from list)
  -p, --project <name>      Show detailed info for project by exact name

${bold("DESCRIPTION:")}
  This command connects to Things 3 and retrieves a list of all projects.
  It uses AppleScript to query Things 3 directly. You can also get detailed
  information about specific projects including:

  - Basic info: title, UUID, status
  - Organization: area, contact, tags
  - Dates: created, modified, scheduled, deadline, completed
  - Task statistics: total tasks, completed tasks, pending tasks, progress percentage
  - Notes and additional details

${bold("EXAMPLES:")}
  prjsync list-projects              # List all projects
  prjsync list-projects -d 5         # Show details for project #5
  prjsync list-projects -p "My Project"  # Show details for "My Project"
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
          console.error(
            red(
              `❌ Invalid project number. Please choose between 1 and ${projects.length}`,
            ),
          );
          Deno.exit(1);
        }
        projectName = projects[projectIndex];
      } else if (args.project) {
        projectName = args.project;
      } else {
        console.error(red("Error: No project specified"));
        Deno.exit(1);
      }

      console.log(
        yellow(`\n🔍 Fetching details for project: ${bold(projectName)}`),
      );

      const projectDetails = await thingsClient.getProjectDetails(projectName);

      if (!projectDetails) {
        console.error(red(`❌ Project "${projectName}" not found`));
        Deno.exit(1);
      }

      displayProjectDetails(projectDetails);
      return;
    }

    // Display all projects list
    console.log(
      green(
        `\n✅ Found ${projects.length} project${
          projects.length === 1 ? "" : "s"
        }:\n`,
      ),
    );

    projects.forEach((project, index) => {
      console.log(`${(index + 1).toString().padStart(3)}. ${project}`);
    });

    console.log(
      dim(
        `\n💡 Use ${bold("--details <number>")} or ${
          bold("--project <name>")
        } to get detailed information about a specific project\n`,
      ),
    );
  } catch (error) {
    console.error(
      red(
        `❌ Error fetching projects: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    );
    if (globalArgs.verbose) {
      console.error(error);
    }
    Deno.exit(1);
  }
}

function displayProjectDetails(details: ProjectDetails): void {
  console.log(green(`\n✅ Project Details:\n`));

  // Basic Information
  console.log(bold("BASIC INFORMATION"));
  console.log(`  Title:         ${details.title}`);
  console.log(`  UUID:          ${cyan(details.uuid)}`);
  console.log(
    `  Status:        ${
      details.status
        ? (details.status === "open"
          ? green(details.status)
          : details.status === "completed"
          ? cyan(details.status)
          : yellow(details.status))
        : dim("(none)")
    }`,
  );

  // Organization
  console.log(`\n${bold("ORGANIZATION")}`);
  console.log(
    `  Area:          ${details.area ? details.area : dim("(none)")}`,
  );
  console.log(
    `  Contact:       ${details.contact ? details.contact : dim("(none)")}`,
  );
  console.log(
    `  Tags:          ${
      details.tags && details.tags.length > 0
        ? cyan(details.tags.join(", "))
        : dim("(none)")
    }`,
  );

  // Dates
  console.log(`\n${bold("DATES")}`);
  console.log(
    `  Created:       ${
      details.creationDate ? yellow(details.creationDate) : dim("(none)")
    }`,
  );
  console.log(
    `  Modified:      ${
      details.modificationDate
        ? yellow(details.modificationDate)
        : dim("(none)")
    }`,
  );
  console.log(
    `  Scheduled:     ${
      details.scheduledDate ? yellow(details.scheduledDate) : dim("(none)")
    }`,
  );
  console.log(
    `  Deadline:      ${
      details.deadline ? red(details.deadline) : dim("(none)")
    }`,
  );
  console.log(
    `  Completed:     ${
      details.completionDate ? cyan(details.completionDate) : dim("(none)")
    }`,
  );

  // Task Statistics
  console.log(`\n${bold("TASKS")}`);
  if (
    details.todoCount !== undefined &&
    details.completedTodoCount !== undefined
  ) {
    const totalTasks = details.todoCount;
    const completedTasks = details.completedTodoCount;
    const pendingTasks = totalTasks - completedTasks;
    const completionPercentage = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    console.log(`  Total:         ${green(totalTasks.toString())}`);
    console.log(`  Completed:     ${cyan(completedTasks.toString())}`);
    console.log(`  Pending:       ${yellow(pendingTasks.toString())}`);
    console.log(`  Progress:      ${cyan(`${completionPercentage}%`)}`);
  } else {
    console.log(`  Total:         ${dim("(none)")}`);
  }

  // Notes
  console.log(`\n${bold("NOTES")}`);
  if (details.notes) {
    console.log(`  ${details.notes.split("\n").join("\n  ")}`);
  } else {
    console.log(`  ${dim("(none)")}`);
  }

  console.log();
}
