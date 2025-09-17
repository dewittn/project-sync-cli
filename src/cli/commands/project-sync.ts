import { parseArgs } from "@std/cli/parse-args";
import { bold, green, yellow } from "@std/fmt/colors";
import { ConfigManager } from "../../config/manager.ts";
import { NocoDBClient, NocoDBRecord } from "../../api/nocodb.ts";

export interface ThingsProject {
  id: string;
  title: string;
  notes?: string;
}

export async function projectSyncCommand(
  args: string[],
  globalFlags: Record<string, unknown>,
): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["help", "dry-run"],
    alias: {
      h: "help",
    },
  });

  if (flags.help) {
    printProjectSyncHelp();
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

  const nocodb = new NocoDBClient(config);

  console.log(bold("Starting project synchronization..."));

  try {
    // Get all projects from Things
    const thingsProjects = await getThingsProjects();
    console.log(`Found ${thingsProjects.length} projects in Things`);

    // Get all records from NocoDB
    const nocodbRecords = await nocodb.getRecords();
    console.log(`Found ${nocodbRecords.length} records in NocoDB`);

    let synced = 0;
    let created = 0;
    let updated = 0;

    for (const project of thingsProjects) {
      if (flags["dry-run"]) {
        console.log(`[DRY RUN] Would process project: ${project.title}`);
        continue;
      }

      if (globalFlags.verbose) {
        console.log(`Processing project: ${project.title}`);
      }

      // Find matching NocoDB record by title
      const matchingRecord = nocodbRecords.find((record: NocoDBRecord) =>
        record.Title === project.title || record.title === project.title
      );

      if (matchingRecord) {
        // Update the Things UUID field if it's different
        const currentUuid = matchingRecord["Things UUID"] ||
          matchingRecord["things_uuid"];
        if (currentUuid !== project.id) {
          const updates: Partial<NocoDBRecord> = {};

          // Try different common field names for UUID
          if (matchingRecord["Things UUID"] !== undefined) {
            updates["Things UUID"] = project.id;
          } else if (matchingRecord["things_uuid"] !== undefined) {
            updates["things_uuid"] = project.id;
          } else if (matchingRecord["UUID"] !== undefined) {
            updates["UUID"] = project.id;
          } else {
            // Default to "Things UUID" if no existing field found
            updates["Things UUID"] = project.id;
          }

          // Update Goal field with notes if available
          if (project.notes) {
            if (matchingRecord["Goal"] !== undefined) {
              updates["Goal"] = project.notes;
            } else if (matchingRecord["goal"] !== undefined) {
              updates["goal"] = project.notes;
            } else if (matchingRecord["Notes"] !== undefined) {
              updates["Notes"] = project.notes;
            } else if (matchingRecord["notes"] !== undefined) {
              updates["notes"] = project.notes;
            }
          }

          await nocodb.updateRecord(matchingRecord.Id, updates);
          console.log(green(`✓ Updated record for project: ${project.title}`));
          updated++;
        } else if (globalFlags.verbose) {
          console.log(`- Project "${project.title}" already has correct UUID`);
        }
      } else {
        // No match found, prompt user for UUID (skippable)
        const shouldCreateRecord = promptForUuid(project);

        if (shouldCreateRecord) {
          const newRecord: Partial<NocoDBRecord> = {
            Title: project.title,
            "Things UUID": project.id,
          };

          if (project.notes) {
            newRecord.Goal = project.notes;
          }

          await nocodb.createRecord(newRecord);
          console.log(
            green(`✓ Created new record for project: ${project.title}`),
          );
          created++;
        } else {
          console.log(yellow(`- Skipped project: ${project.title}`));
        }
      }

      synced++;
    }

    console.log(green(bold("✓ Project sync completed successfully!")));
    console.log(`  Projects processed: ${synced}`);
    console.log(`  Records created: ${created}`);
    console.log(`  Records updated: ${updated}`);
  } catch (error) {
    throw new Error(`Project sync failed: ${error.message}`);
  }
}

async function getThingsProjects(): Promise<ThingsProject[]> {
  const script = `
    tell application "Things3"
      set projectList to {}
      repeat with proj in projects
        set projId to id of proj as string
        set projTitle to name of proj as string
        set projNotes to ""

        try
          set projNotes to notes of proj as string
        end try

        set projectList to projectList & {projId & "|" & projTitle & "|" & projNotes}
      end repeat
      return projectList as string
    end tell
  `;

  const command = new Deno.Command("osascript", {
    args: ["-e", script],
  });

  const { stdout, stderr } = await command.output();

  if (stderr.length > 0) {
    throw new Error(
      `Failed to fetch projects: ${new TextDecoder().decode(stderr)}`,
    );
  }

  const output = new TextDecoder().decode(stdout).trim();

  if (!output || output === "") {
    return [];
  }

  const projects: ThingsProject[] = [];
  const projectLines = output.split(", ");

  for (const line of projectLines) {
    const parts = line.split("|");
    if (parts.length >= 2) {
      const project: ThingsProject = {
        id: parts[0],
        title: parts[1],
        notes: parts[2] || undefined,
      };
      projects.push(project);
    }
  }

  return projects;
}

function promptForUuid(project: ThingsProject): boolean {
  console.log(
    yellow(`\nNo matching record found for project: "${project.title}"`),
  );
  console.log(`Project UUID: ${project.id}`);

  if (project.notes) {
    console.log(
      `Project notes: ${project.notes.substring(0, 100)}${
        project.notes.length > 100 ? "..." : ""
      }`,
    );
  }

  const input = prompt("Create new record? [y/N/s to skip all remaining]: ");

  if (input?.toLowerCase() === "s") {
    // Skip all remaining
    return false;
  }

  return input?.toLowerCase() === "y" || input?.toLowerCase() === "yes";
}

function printProjectSyncHelp(): void {
  console.log(`
${bold("PROJECT SYNC COMMAND")}
Synchronize Things projects with NocoDB records

${bold("USAGE:")}
  nocodb-things project-sync [options]

${bold("OPTIONS:")}
  -h, --help              Show this help message
  --dry-run               Preview changes without applying them

${bold("BEHAVIOR:")}
  • Projects in Things get matched to NocoDB records by title
  • If a match is found, the Things UUID field is updated
  • If no match is found, you'll be prompted to create a new record
  • Project notes update the Goal field in NocoDB
  • Prompts are skippable (press Enter or 'n' to skip, 's' to skip all)

${bold("EXAMPLES:")}
  nocodb-things project-sync                # Sync all projects
  nocodb-things project-sync --dry-run      # Preview changes only
`);
}
