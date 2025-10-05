import { parseArgs } from "@std/cli/parse-args";
import { bold, cyan, green, yellow } from "@std/fmt/colors";
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
    boolean: ["help", "dry-run", "debug"],
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

  console.log(bold("Syncing Things projects to NocoDB..."));

  // Get field mappings from config
  const customMappings = config.get("fieldMappings") || {};
  const defaultMappings: Record<string, string> = {
    "Title": "title",
    "Project Name": "title",
    "Things UUID": "id",
    "Goal": "notes",
    "Area": "area",
  };

  // Merge custom and default mappings (custom takes precedence)
  const fieldMappings = { ...defaultMappings, ...customMappings };

  // Build reverse mappings: Things property -> NocoDB field names
  const uuidFields: string[] = [];
  const titleFields: string[] = [];

  for (const [nocodbField, thingsProperty] of Object.entries(fieldMappings)) {
    if (thingsProperty === "id") {
      uuidFields.push(nocodbField);
    } else if (thingsProperty === "title") {
      titleFields.push(nocodbField);
    }
  }

  try {
    // Get all projects from Things
    const thingsProjects = await getThingsProjects();
    console.log(`Found ${thingsProjects.length} projects in Things`);

    // Get all records from NocoDB
    if (flags.debug) {
      console.log(cyan(bold("\n🔗 NocoDB Initial Query:")));
      console.log(
        cyan(
          `  GET ${config.get("nocodbUrl")}/api/v2/tables/{tableId}/records`,
        ),
      );
      console.log(cyan("  Query parameters:"));
      console.log(cyan("    limit: 100 (default)"));
      console.log(cyan("    offset: 0 (default)"));
      console.log(
        cyan("  Note: Fetching all records for client-side matching"),
      );
    }

    const nocodbRecords = await nocodb.getRecords();
    console.log(`Found ${nocodbRecords.length} records in NocoDB`);

    // Debug mode: Show list of records and save to file
    if (flags.debug) {
      console.log(cyan(bold("\n📋 NocoDB Records Found:")));

      // Display project names from records
      const projectNames = nocodbRecords.map((record, index) => {
        // Try different field names for project name
        const name = record["Project Name"] || record["Title"] ||
          record["project_name"] || record["title"] || record["Name"] ||
          record["name"] || `Record ${index + 1}`;
        return `  ${index + 1}. ${name}`;
      });

      if (projectNames.length > 0) {
        console.log(cyan(projectNames.join("\n")));
      } else {
        console.log(cyan("  (no records found)"));
      }

      // Save full records to JSON file
      const debugDir = ".nocodb-things-debug";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const debugFilePath = `${debugDir}/nocodb-records-${timestamp}.json`;

      try {
        // Create debug directory if it doesn't exist
        await Deno.mkdir(debugDir, { recursive: true });

        // Write records to JSON file
        await Deno.writeTextFile(
          debugFilePath,
          JSON.stringify(nocodbRecords, null, 2),
        );

        console.log(
          cyan(
            `\n  📁 Full response saved to: ${debugFilePath}`,
          ),
        );
      } catch (error) {
        console.log(
          yellow(
            `\n  ⚠️  Could not save debug file: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    }

    let synced = 0;
    let created = 0;
    let updated = 0;

    for (const project of thingsProjects) {
      if (flags["dry-run"]) {
        console.log(`[DRY RUN] Would process project: ${project.title}`);
        continue;
      }

      // Debug mode: show project data before processing
      if (flags.debug) {
        printDebugThingsProject(project);
      }

      if (globalFlags.verbose) {
        console.log(`Processing project: ${project.title}`);
      }

      // Two-step search: First by UUID, then by Title
      let matchingRecord: NocoDBRecord | undefined;

      // Step 1: Search by Things UUID (primary method)
      if (flags.debug && uuidFields.length > 0) {
        printDebugSearchCriteria(
          "uuid",
          project.id,
          uuidFields,
          nocodbRecords.length,
        );
      }

      if (uuidFields.length > 0) {
        matchingRecord = nocodbRecords.find((record: NocoDBRecord) => {
          return uuidFields.some((field) => record[field] === project.id);
        });
      }

      // Step 2: If no UUID match, search by Title (fallback)
      if (!matchingRecord) {
        if (flags.debug && titleFields.length > 0) {
          printDebugSearchCriteria(
            "title",
            project.title,
            titleFields,
            nocodbRecords.length,
          );
        }

        if (titleFields.length > 0) {
          matchingRecord = nocodbRecords.find((record: NocoDBRecord) => {
            return titleFields.some((field) => record[field] === project.title);
          });
        }
      }

      // Debug mode: show matched record
      if (flags.debug) {
        printDebugMatchedRecord(matchingRecord || null);
      }

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
          const recordId = await nocodb.getRecordId(matchingRecord);

          // Debug mode: show data being sent
          if (flags.debug) {
            printDebugSyncData(updates);
          }

          const result = await nocodb.updateRecord(recordId, updates);

          // Debug mode: show HTTP response
          if (flags.debug) {
            printDebugHttpResponse(200, "OK", result);
          }

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

          // Debug mode: show data being sent
          if (flags.debug) {
            printDebugSyncData(newRecord);
          }

          const result = await nocodb.createRecord(newRecord);

          // Debug mode: show HTTP response
          if (flags.debug) {
            printDebugHttpResponse(201, "Created", result);
          }

          console.log(
            green(`✓ Created new record for project: ${project.title}`),
          );
          created++;
        } else {
          console.log(yellow(`- Skipped project: ${project.title}`));
        }
      }

      synced++;

      // Debug mode: confirm before continuing to next project
      if (flags.debug && synced < thingsProjects.length) {
        if (!confirmContinue()) {
          console.log(yellow("\nSync stopped by user."));
          break;
        }
      }
    }

    console.log(green(bold("✓ Sync completed successfully!")));
    console.log(`  Projects processed: ${synced}`);
    console.log(`  Records created: ${created}`);
    console.log(`  Records updated: ${updated}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Sync failed: ${errorMessage}`);
  }
}

async function getThingsProjects(): Promise<ThingsProject[]> {
  const script = `
    tell application "Things3"
      set outputList to {}
      repeat with proj in projects
        -- Check if project is recurring (has a repeater)
        set isRecurring to false
        try
          set projRepeater to repeater of proj
          if projRepeater is not missing value then
            set isRecurring to true
          end if
        on error
          -- No repeater property means not recurring
        end try

        -- Only include non-recurring projects
        if not isRecurring then
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

          set end of outputList to "PROJECT_START|" & projId & "|" & projTitle & "|" & projNotes & "|" & projArea & "|PROJECT_END"
        end if
      end repeat

      -- Join with newlines to avoid AppleScript list to string issues
      set AppleScript's text item delimiters to linefeed
      set outputString to outputList as string
      set AppleScript's text item delimiters to ""
      return outputString
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
  const projectLines = output.split("\n");

  for (const line of projectLines) {
    if (line.includes("PROJECT_START") && line.includes("PROJECT_END")) {
      const match = line.match(
        /PROJECT_START\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|PROJECT_END/,
      );
      if (match) {
        const [_, id, title, notes, area] = match;
        const project: ThingsProject = {
          id: id || "",
          title: title || "",
          notes: notes || undefined,
          area: cleanAreaName(area) || undefined,
        };
        if (project.id && project.title) {
          projects.push(project);
        }
      }
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
  let cleaned = areaName.replace(uuidPattern, "");

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

function printDebugThingsProject(project: ThingsProject): void {
  console.log(cyan(bold("\n📋 Things Project Data:")));
  console.log(cyan(`  Title: ${project.title}`));
  console.log(cyan(`  ID: ${project.id}`));
  console.log(cyan(`  Notes: ${project.notes || "(none)"}`));
  console.log(cyan(`  Area: ${project.area || "(none)"}`));
}

function printDebugSyncData(data: Partial<NocoDBRecord>): void {
  console.log(cyan(bold("\n📤 Data being sent to NocoDB:")));
  console.log(cyan(JSON.stringify(data, null, 2)));
}

function printDebugSearchCriteria(
  searchType: "uuid" | "title",
  searchValue: string,
  fields: string[],
  totalRecords: number,
): void {
  console.log(cyan(bold("\n🔎 Searching NocoDB for Matching Record:")));
  if (searchType === "uuid") {
    console.log(cyan(`  Step 1: Searching by Things UUID = "${searchValue}"`));
  } else {
    console.log(
      cyan(`  Step 2: No UUID match, searching by Title = "${searchValue}"`),
    );
  }
  console.log(
    cyan(`  Checking fields: ${fields.map((f) => `record.${f}`).join(" OR ")}`),
  );
  console.log(cyan(`  Total records to search: ${totalRecords}`));

  // Show equivalent NocoDB where clause
  if (fields.length > 0) {
    const whereConditions = fields.map((field) =>
      `('${field}',eq,'${searchValue}')`
    );
    const whereClause = whereConditions.join("~or");
    console.log(cyan(bold("\n  Equivalent NocoDB query parameter:")));
    console.log(cyan(`    where=${whereClause}`));
    console.log(cyan(`  Note: Currently using client-side filtering`));
  }
}

function printDebugMatchedRecord(record: NocoDBRecord | null): void {
  if (record) {
    console.log(cyan(bold("\n✓ Match Found:")));
    console.log(cyan(JSON.stringify(record, null, 2)));
  } else {
    console.log(cyan(bold("\n✗ No Match Found")));
    console.log(cyan("  No existing NocoDB record with matching title"));
  }
}

function printDebugHttpResponse(
  status: number,
  statusText: string,
  body: unknown,
): void {
  console.log(cyan(bold("\n📡 HTTP Response from NocoDB:")));
  console.log(cyan(`  Status: ${status} ${statusText}`));
  console.log(cyan(`  Body: ${JSON.stringify(body, null, 2)}`));
}

function confirmContinue(): boolean {
  const input = prompt(yellow("\nContinue to next project? (y/n): "));
  return input?.toLowerCase() === "y" || input?.toLowerCase() === "yes";
}

function printProjectSyncHelp(): void {
  console.log(`
${bold("SYNC COMMAND")}
Synchronize Things projects to NocoDB

${bold("USAGE:")}
  nocodb-things sync [options]

${bold("OPTIONS:")}
  -h, --help              Show this help message
  --dry-run               Preview changes without applying them
  --debug                 Enable debug mode with step-by-step confirmation

${bold("BEHAVIOR:")}
  • One-way sync: Things projects → NocoDB records
  • Two-step matching: First by Things UUID, then by Title (fallback)
  • Uses field mappings from config for flexible field names
  • Updates Things UUID in NocoDB records
  • Creates new records for unmatched projects
  • Project notes update the Goal field

${bold("DEBUG MODE:")}
  • Process one project at a time with confirmation prompts
  • Display NocoDB API query parameters (GET request details)
  • List all NocoDB records found (project names only)
  • Save full NocoDB response to .nocodb-things-debug/ directory
  • Display Things project data before sync
  • Display two-step search process (UUID → Title)
  • Show which NocoDB fields are being checked
  • Show equivalent NocoDB where clause for each search
  • Display matched NocoDB record (if found)
  • Display data being sent to NocoDB
  • Display full HTTP response from NocoDB

${bold("EXAMPLES:")}
  nocodb-things                  # Sync all projects (default)
  nocodb-things sync             # Sync all projects
  nocodb-things sync --dry-run   # Preview changes only
  nocodb-things sync --debug     # Debug mode with step-by-step confirmation
`);
}
