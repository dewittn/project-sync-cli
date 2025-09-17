import { parseArgs } from "@std/cli/parse-args";
import { bold, green, yellow } from "@std/fmt/colors";
import { ConfigManager } from "../../config/manager.ts";
import { NocoDBClient, NocoDBRecord } from "../../api/nocodb.ts";

export interface ThingsProject {
  id: string;
  title: string;
  notes?: string;
  area?: string;
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
        const updates: Partial<NocoDBRecord> = {};
        let needsUpdate = false;

        // Always update UUID if different
        if (currentUuid !== project.id) {
          needsUpdate = true;
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
        }

        // Always update Project Name
        if (matchingRecord["Project Name"] !== undefined) {
          updates["Project Name"] = project.title;
        } else if (matchingRecord["project_name"] !== undefined) {
          updates["project_name"] = project.title;
        } else {
          updates["Project Name"] = project.title;
        }
        needsUpdate = true;

        // Always update Goal field
        const goalValue = project.notes || "";
        if (matchingRecord["Goal"] !== undefined) {
          updates["Goal"] = goalValue;
        } else if (matchingRecord["goal"] !== undefined) {
          updates["goal"] = goalValue;
        } else if (matchingRecord["Notes"] !== undefined) {
          updates["Notes"] = goalValue;
        } else if (matchingRecord["notes"] !== undefined) {
          updates["notes"] = goalValue;
        } else {
          updates["Goal"] = goalValue;
        }
        needsUpdate = true;

        // Update Area field if available
        if (project.area) {
          if (matchingRecord["Area"] !== undefined) {
            updates["Area"] = project.area;
          } else if (matchingRecord["area"] !== undefined) {
            updates["area"] = project.area;
          } else {
            updates["Area"] = project.area;
          }
          needsUpdate = true;
        }

        if (needsUpdate) {
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
            "Project Name": project.title,
            "Things UUID": project.id,
            Goal: project.notes || "",
          };

          if (project.area) {
            newRecord.Area = project.area;
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
        set projArea to ""

        try
          set projNotes to notes of proj as string
        end try

        try
          set projArea to name of area of proj as string
        end try

        set projectList to projectList & {projId & "|" & projTitle & "|" & projNotes & "|" & projArea}
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
        area: cleanAreaName(parts[3]) || undefined,
      };
      projects.push(project);
    }
  }

  return projects;
}

function cleanAreaName(areaName?: string): string | undefined {
  if (!areaName) {
    return undefined;
  }

  // Things often appends UUIDs to area names (e.g., "Authoring3nhWkQwUK5mEKctntFKfHj")
  // UUIDs are typically 22+ characters long and contain alphanumeric characters
  // We'll try to detect and remove UUID patterns from the end of the string

  // Pattern 1: Remove UUID-like suffixes (long alphanumeric strings at the end)
  const uuidPattern = /[A-Za-z0-9]{20,}$/;
  let cleaned = areaName.replace(uuidPattern, '');

  // Pattern 2: Sometimes there might be a separator or other patterns
  // If we detect common separators, try to split and take the first part
  if (cleaned === areaName) {
    // If the UUID pattern didn't match, try looking for other patterns
    // Look for transitions from letters to a long string of mixed case
    const transitionPattern = /^([A-Za-z\s]+)[A-Z0-9a-z]{15,}$/;
    const match = areaName.match(transitionPattern);
    if (match) {
      cleaned = match[1];
    }
  }

  // Clean up any trailing whitespace or special characters
  cleaned = cleaned.trim();

  // Return undefined if the result is empty
  return cleaned.length > 0 ? cleaned : undefined;
}

function promptForUuid(project: ThingsProject): boolean {
  console.log(
    yellow(`\nNo matching record found for project: "${project.title}"`),
  );
  console.log(`Project UUID: ${project.id}`);

  if (project.area) {
    console.log(`Project area: ${project.area}`);
  }

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
