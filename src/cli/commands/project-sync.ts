import { parseArgs } from "@std/cli/parse-args";
import { bold, cyan, gray, green, red, yellow } from "@std/fmt/colors";
import { ConfigManager } from "../../config/manager.ts";
import {
  NocoDBClient,
  NocoDBHTTPError,
  NocoDBRecord,
} from "../../api/nocodb.ts";
import { Input, Select } from "@cliffy/prompt";

export interface ThingsProject {
  id: string;
  title: string;
  notes: string;
  area?: string;
}

export async function projectSyncCommand(
  args: string[],
  globalFlags: Record<string, unknown>,
): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["help", "dry-run", "debug", "verbose"],
    alias: {
      h: "help",
      v: "verbose",
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
      console.log(cyan(bold("\n🔗 NocoDB Pagination Query:")));
      console.log(
        cyan(
          `  GET ${config.get("nocodbUrl")}/api/v2/tables/{tableId}/records`,
        ),
      );
      console.log(cyan("  Query parameters:"));
      console.log(cyan("    limit: 100 (per request)"));
      console.log(cyan("    offset: incremented until all records fetched"));
      console.log(
        cyan("  Note: Using pagination to fetch all records"),
      );
    }

    // Fetch records with optional progress callback for debug mode
    const nocodbRecords = await nocodb.getRecords(
      flags.debug
        ? (fetched: number, batch: number) => {
          if (batch > 0) {
            console.log(
              cyan(
                `  📥 Fetched batch of ${batch} records (total: ${fetched})`,
              ),
            );
          }
        }
        : undefined,
    );

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
        if (matchingRecord["Goal"] !== undefined) {
          updates["Goal"] = project.notes;
        } else if (matchingRecord["goal"] !== undefined) {
          updates["goal"] = project.notes;
        } else if (matchingRecord["Notes"] !== undefined) {
          updates["Notes"] = project.notes;
        } else if (matchingRecord["notes"] !== undefined) {
          updates["notes"] = project.notes;
        } else {
          updates["Goal"] = project.notes;
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

          // Verbose mode: show sync data with response
          if (flags.verbose) {
            printVerboseSync(project, "update", updates, recordId, result);
            console.log(green(`✓ Successfully updated`));
          } else {
            console.log(
              green(`✓ Updated record for project: ${project.title}`),
            );
          }
          updated++;
        } else if (globalFlags.verbose) {
          console.log(`- Project "${project.title}" already has correct UUID`);
        }
      } else {
        // No match found, prompt user for create/skip/debug/search
        const response = promptForUuid(project);

        if (response.action === "debug") {
          // Show debug info
          printDebugThingsProject(project);
          printDebugSearchCriteria(
            "uuid",
            project.id,
            uuidFields,
            nocodbRecords.length,
          );
          printDebugSearchCriteria(
            "title",
            project.title,
            titleFields,
            nocodbRecords.length,
          );
          printDebugMatchedRecord(null);

          // Ask again what to do
          const secondResponse = promptForUuid(project);
          if (secondResponse.action === "search") {
            // Handle search action
            const selectedRecord = await selectRecordInteractively(
              nocodbRecords,
              project,
            );
            if (selectedRecord) {
              matchingRecord = selectedRecord;
              // Update the selected record with project data (same as match logic)
              const updates: Partial<NocoDBRecord> = {};

              // Update UUID
              if (selectedRecord["Things UUID"] !== undefined) {
                updates["Things UUID"] = project.id;
              } else if (selectedRecord["things_uuid"] !== undefined) {
                updates["things_uuid"] = project.id;
              } else if (selectedRecord["UUID"] !== undefined) {
                updates["UUID"] = project.id;
              } else {
                updates["Things UUID"] = project.id;
              }

              // Update Project Name
              if (selectedRecord["Project Name"] !== undefined) {
                updates["Project Name"] = project.title;
              } else if (selectedRecord["project_name"] !== undefined) {
                updates["project_name"] = project.title;
              } else {
                updates["Project Name"] = project.title;
              }

              // Update Goal field
              if (selectedRecord["Goal"] !== undefined) {
                updates["Goal"] = project.notes;
              } else if (selectedRecord["goal"] !== undefined) {
                updates["goal"] = project.notes;
              } else if (selectedRecord["Notes"] !== undefined) {
                updates["Notes"] = project.notes;
              } else if (selectedRecord["notes"] !== undefined) {
                updates["notes"] = project.notes;
              } else {
                updates["Goal"] = project.notes;
              }

              // Update Area field if available
              if (project.area) {
                if (selectedRecord["Area"] !== undefined) {
                  updates["Area"] = project.area;
                } else if (selectedRecord["area"] !== undefined) {
                  updates["area"] = project.area;
                } else {
                  updates["Area"] = project.area;
                }
              }

              const recordId = await nocodb.getRecordId(selectedRecord);

              if (flags.debug) {
                printDebugSyncData(updates);
              }

              const result = await nocodb.updateRecord(recordId, updates);

              if (flags.debug) {
                printDebugHttpResponse(200, "OK", result);
              }

              // Verbose mode: show sync data with response
              if (flags.verbose) {
                printVerboseSync(project, "link", updates, recordId, result);
                console.log(green(`✓ Successfully linked and updated`));
              } else {
                console.log(
                  green(
                    `✓ Linked and updated record for project: ${project.title}`,
                  ),
                );
              }
              updated++;
              synced++;
              continue;
            } else {
              console.log(yellow(`- Skipped project: ${project.title}`));
              synced++;
              continue;
            }
          } else if (secondResponse.action !== "create") {
            console.log(yellow(`- Skipped project: ${project.title}`));
            synced++;
            continue;
          }
        } else if (response.action === "skip") {
          console.log(yellow(`- Skipped project: ${project.title}`));
          synced++;
          continue;
        } else if (response.action === "search") {
          // Handle search action
          const selectedRecord = await selectRecordInteractively(
            nocodbRecords,
            project,
          );
          if (selectedRecord) {
            matchingRecord = selectedRecord;
            // Update the selected record with project data
            const updates: Partial<NocoDBRecord> = {};

            // Update UUID
            if (selectedRecord["Things UUID"] !== undefined) {
              updates["Things UUID"] = project.id;
            } else if (selectedRecord["things_uuid"] !== undefined) {
              updates["things_uuid"] = project.id;
            } else if (selectedRecord["UUID"] !== undefined) {
              updates["UUID"] = project.id;
            } else {
              updates["Things UUID"] = project.id;
            }

            // Update Project Name
            if (selectedRecord["Project Name"] !== undefined) {
              updates["Project Name"] = project.title;
            } else if (selectedRecord["project_name"] !== undefined) {
              updates["project_name"] = project.title;
            } else {
              updates["Project Name"] = project.title;
            }

            // Update Goal field
            if (selectedRecord["Goal"] !== undefined) {
              updates["Goal"] = project.notes;
            } else if (selectedRecord["goal"] !== undefined) {
              updates["goal"] = project.notes;
            } else if (selectedRecord["Notes"] !== undefined) {
              updates["Notes"] = project.notes;
            } else if (selectedRecord["notes"] !== undefined) {
              updates["notes"] = project.notes;
            } else {
              updates["Goal"] = project.notes;
            }

            // Update Area field if available
            if (project.area) {
              if (selectedRecord["Area"] !== undefined) {
                updates["Area"] = project.area;
              } else if (selectedRecord["area"] !== undefined) {
                updates["area"] = project.area;
              } else {
                updates["Area"] = project.area;
              }
            }

            const recordId = await nocodb.getRecordId(selectedRecord);

            if (flags.debug) {
              printDebugSyncData(updates);
            }

            const result = await nocodb.updateRecord(recordId, updates);

            if (flags.debug) {
              printDebugHttpResponse(200, "OK", result);
            }

            // Verbose mode: show sync data with response
            if (flags.verbose) {
              printVerboseSync(project, "link", updates, recordId, result);
              console.log(green(`✓ Successfully linked and updated`));
            } else {
              console.log(
                green(
                  `✓ Linked and updated record for project: ${project.title}`,
                ),
              );
            }
            updated++;
            synced++;
            continue;
          } else {
            console.log(yellow(`- Skipped project: ${project.title}`));
            synced++;
            continue;
          }
        }

        // Create the record
        const newRecord: Partial<NocoDBRecord> = {
          Title: project.title,
          "Project Name": project.title,
          "Things UUID": project.id,
          Goal: project.notes,
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

        // Verbose mode: show sync data with response
        if (flags.verbose) {
          printVerboseSync(project, "create", newRecord, undefined, result);
          console.log(green(`✓ Successfully created`));
        } else {
          console.log(
            green(`✓ Created new record for project: ${project.title}`),
          );
        }
        created++;
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
    console.log("");
    console.log(red(bold("❌ Sync Failed")));
    console.log("");

    // If it's a NocoDBHTTPError, display detailed information
    if (error instanceof NocoDBHTTPError) {
      console.log(error.toDetailedString());
    } else if (error instanceof Error) {
      console.log(red(`Error: ${error.message}`));
      if (error.stack && flags.debug) {
        console.log("");
        console.log(yellow("Stack trace:"));
        console.log(yellow(error.stack));
      }
    } else {
      console.log(red(`Error: ${String(error)}`));
    }

    console.log("");
    Deno.exit(1);
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

        -- Check if project is completed
        set isCompleted to false
        try
          set projStatus to status of proj
          if projStatus is completed then
            set isCompleted to true
          end if
        on error
          -- If we can't get status, assume not completed
        end try

        -- Only include non-recurring and non-completed projects
        if not isRecurring and not isCompleted then
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
          notes: notes || "",
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

/**
 * Simple fuzzy search implementation
 * Scores records based on how well they match the search query
 */
function fuzzySearch(
  records: NocoDBRecord[],
  query: string,
): Array<{ record: NocoDBRecord; score: number; displayName: string }> {
  if (!query || query.trim() === "") {
    return records.map((record) => ({
      record,
      score: 0,
      displayName: getRecordDisplayName(record),
    }));
  }

  const queryLower = query.toLowerCase();
  const results = records.map((record) => {
    const displayName = getRecordDisplayName(record);
    const nameLower = displayName.toLowerCase();

    // Calculate score based on:
    // 1. Exact match (highest score)
    // 2. Starts with query
    // 3. Contains query
    // 4. Contains all characters in order (fuzzy match)
    let score = 0;

    if (nameLower === queryLower) {
      score = 1000;
    } else if (nameLower.startsWith(queryLower)) {
      score = 500;
    } else if (nameLower.includes(queryLower)) {
      score = 250;
    } else {
      // Fuzzy match: check if all query characters appear in order
      let queryIndex = 0;
      for (
        let i = 0;
        i < nameLower.length && queryIndex < queryLower.length;
        i++
      ) {
        if (nameLower[i] === queryLower[queryIndex]) {
          queryIndex++;
          score += 10;
        }
      }
      if (queryIndex < queryLower.length) {
        score = 0; // Not all characters found
      }
    }

    return { record, score, displayName };
  });

  return results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

/**
 * Get a display name for a NocoDB record
 */
function getRecordDisplayName(record: NocoDBRecord): string {
  const id = record.Id || record.id || record.ID || "?";
  const name = record["Project Name"] || record["Title"] ||
    record["project_name"] || record["title"] || record["Name"] ||
    record["name"] || `Record ${id}`;
  return `${name} (ID: ${id})`;
}

/**
 * Interactive record selector with fuzzy search
 */
async function selectRecordInteractively(
  records: NocoDBRecord[],
  project: ThingsProject,
): Promise<NocoDBRecord | null> {
  console.log(
    cyan(
      `\n🔍 Search for a record to link with "${project.title}" (${records.length} records available)`,
    ),
  );
  console.log(
    cyan(
      "Type to filter, use arrow keys to select, Enter to confirm, Ctrl+C to cancel\n",
    ),
  );

  // Use Input prompt for search with dynamic suggestions
  const searchQuery = await Input.prompt({
    message: "Search records:",
    suggestions: records.map(getRecordDisplayName),
    list: true,
  });

  if (!searchQuery) {
    return null;
  }

  // Filter records based on search
  const matchedRecords = fuzzySearch(records, searchQuery);

  if (matchedRecords.length === 0) {
    console.log(yellow("No records match your search."));
    return null;
  }

  // If only one match, ask for confirmation
  if (matchedRecords.length === 1) {
    const confirmSelection = await Select.prompt({
      message: `Found 1 matching record. Select it?`,
      options: [
        { name: `✓ ${matchedRecords[0].displayName}`, value: "yes" },
        { name: "✗ Cancel", value: "no" },
      ],
    });

    if (confirmSelection === "yes") {
      return matchedRecords[0].record;
    }
    return null;
  }

  // Multiple matches, show selection menu
  const selection = await Select.prompt({
    message: `Found ${matchedRecords.length} matching records. Select one:`,
    options: [
      ...matchedRecords.slice(0, 20).map((item) => ({
        name: item.displayName,
        value: item.record,
      })),
      ...(matchedRecords.length > 20
        ? [{
          name: "--- (showing top 20 results) ---",
          value: null,
          disabled: true,
        }]
        : []),
      { name: "✗ Cancel", value: null },
    ],
  });

  return selection as NocoDBRecord | null;
}

function promptForUuid(
  project: ThingsProject,
): { action: "create" | "skip" | "debug" | "search" } {
  console.log("");
  console.log(yellow(bold("━".repeat(70))));
  console.log(
    yellow(bold(`No matching record found for project: "${project.title}"`)),
  );
  console.log(yellow(bold("━".repeat(70))));
  console.log("");
  console.log(bold("Things Project Details:"));
  console.log(`  Title:  ${cyan(project.title)}`);
  console.log(`  UUID:   ${cyan(project.id)}`);
  console.log(
    `  Area:   ${project.area ? cyan(project.area) : gray("(none)")}`,
  );

  if (project.notes) {
    console.log(
      `  Notes:  ${cyan(project.notes.substring(0, 200))}${
        project.notes.length > 200 ? cyan("...") : ""
      }`,
    );
  } else {
    console.log(`  Notes:  ${gray("(none)")}`);
  }

  console.log("");
  const input = prompt(
    "Options: [c]Create new / [f]Find & select / [s]Skip all / [d]Debug / [n]Skip this: ",
  );

  const inputLower = input?.toLowerCase();

  if (inputLower === "s" || inputLower === "skip") {
    return { action: "skip" };
  }

  if (inputLower === "d" || inputLower === "debug") {
    return { action: "debug" };
  }

  if (inputLower === "f" || inputLower === "find") {
    return { action: "search" };
  }

  if (inputLower === "c" || inputLower === "create") {
    return { action: "create" };
  }

  // Default to skip this project (n or anything else)
  return { action: "skip" };
}

/**
 * Print verbose sync information
 */
function printVerboseSync(
  project: ThingsProject,
  operation: "create" | "update" | "link",
  updates: Partial<NocoDBRecord>,
  recordId?: string,
  response?: unknown,
): void {
  console.log("");
  console.log(bold(`Syncing: "${project.title}"`));
  console.log(gray("─".repeat(60)));
  console.log("");
  console.log(bold("Things Data:"));
  console.log(`  Title:        ${cyan(project.title)}`);
  console.log(`  UUID:         ${cyan(project.id)}`);
  console.log(
    `  Notes:        ${
      project.notes
        ? cyan(
          project.notes.length > 100
            ? project.notes.substring(0, 100) + "..."
            : project.notes,
        )
        : gray("(empty)")
    }`,
  );
  console.log(
    `  Area:         ${project.area ? cyan(project.area) : gray("(none)")}`,
  );
  console.log("");

  const operationText = {
    create: "Create new record",
    update: "Update existing record",
    link: "Link to selected record",
  }[operation];
  console.log(bold("Operation:      ") + green(operationText));

  if (recordId) {
    console.log(bold("NocoDB Record:  ") + `ID ${cyan(recordId)}`);
  }

  console.log("");
  console.log(bold("Field Mappings:"));

  // Display field mappings
  for (const [field, value] of Object.entries(updates)) {
    const thingsField = getThingsFieldName(field);
    const displayValue = typeof value === "string"
      ? (value === "" ? gray("(empty)") : cyan(value))
      : cyan(String(value));
    console.log(
      `  ${thingsField.padEnd(12)} → ${field.padEnd(15)} : ${displayValue}`,
    );
  }

  // Display HTTP response if provided
  if (response) {
    console.log("");
    console.log(bold("NocoDB Response:"));
    try {
      const responseStr = JSON.stringify(response, null, 2);
      // Indent each line
      const indentedResponse = responseStr.split("\n").map((line) =>
        `  ${line}`
      ).join("\n");
      console.log(cyan(indentedResponse));
    } catch {
      console.log(cyan(`  ${String(response)}`));
    }
  }

  console.log("");
}

/**
 * Get the Things field name for a NocoDB field
 */
function getThingsFieldName(nocodbField: string): string {
  const mapping: Record<string, string> = {
    "Things UUID": "uuid",
    "things_uuid": "uuid",
    "UUID": "uuid",
    "Project Name": "title",
    "project_name": "title",
    "Title": "title",
    "Goal": "notes",
    "goal": "notes",
    "Notes": "notes",
    "notes": "notes",
    "Area": "area",
    "area": "area",
  };
  return mapping[nocodbField] || nocodbField.toLowerCase();
}

function printDebugThingsProject(project: ThingsProject): void {
  console.log(cyan(bold("\n📋 Things Project Data:")));
  console.log(cyan(`  Title: ${project.title}`));
  console.log(cyan(`  ID: ${project.id}`));
  console.log(cyan(`  Notes: ${project.notes || "(empty)"}`));
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
  -v, --verbose           Show detailed sync information for each project
  --dry-run               Preview changes without applying them
  --debug                 Enable debug mode with step-by-step confirmation

${bold("BEHAVIOR:")}
  • One-way sync: Things projects → NocoDB records
  • Excludes completed projects (only syncs active projects)
  • Excludes recurring projects
  • Fetches ALL records from NocoDB using pagination (100 per request)
  • Two-step matching: First by Things UUID, then by Title (fallback)
  • Uses field mappings from config for flexible field names
  • Interactive prompt when creating new records (with debug option)
  • Updates Things UUID in NocoDB records
  • Creates new records for unmatched projects
  • Project notes update the Goal field

${bold("VERBOSE MODE:")}
  For each project being synced, displays:
  • Things project data (Title, UUID, Notes, Area)
  • Sync operation type (Create/Update/Link)
  • NocoDB record ID (if updating existing record)
  • Field mappings showing what data is being sent to each NocoDB field
  • Success confirmation for each operation

  Use this mode to verify data is syncing correctly without API-level details.

${bold("DEBUG MODE:")}
  • Process one project at a time with confirmation prompts
  • Display NocoDB API query parameters (GET request details)
  • Show pagination progress (batches of 100 records)
  • List all NocoDB records found (project names only)
  • Save full NocoDB response to .nocodb-things-debug/ directory
  • Display Things project data before sync
  • Display two-step search process (UUID → Title)
  • Show which NocoDB fields are being checked
  • Show equivalent NocoDB where clause for each search
  • Display matched NocoDB record (if found)
  • Display data being sent to NocoDB
  • Display full HTTP response from NocoDB

${bold("INTERACTIVE PROMPTS:")}
  When no matching record is found, you'll be prompted with project details:
  • "Options: [c]Create new / [f]Find & select / [s]Skip all / [d]Debug / [n]Skip this"
    - c: Create a new record for this project
    - f: Search and select an existing record to link (interactive fuzzy search)
    - s: Skip all remaining projects
    - d: Show debug info for this project, then ask again
    - n: Skip this project (default)

  Project details displayed:
    - Title, UUID, Area, and Notes (up to 200 characters)

  ${bold("Find & Select Mode:")}
  • Type to search through all NocoDB records with fuzzy matching
  • See real-time filtered results as you type
  • Use arrow keys to navigate through matching records
  • Press Enter to select and link a record
  • Handles 100+ records efficiently with top 20 results shown
  • Selected record will be updated with project UUID and data

${bold("EXAMPLES:")}
  nocodb-things                    # Sync all projects (default)
  nocodb-things sync               # Sync all projects
  nocodb-things sync --verbose     # Sync with detailed output for each project
  nocodb-things sync -v            # Short form of --verbose
  nocodb-things sync --dry-run     # Preview changes only
  nocodb-things sync --debug       # Debug mode with step-by-step confirmation
  nocodb-things sync -v --debug    # Combine verbose and debug modes
`);
}
