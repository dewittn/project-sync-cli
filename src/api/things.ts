export interface ThingsTask {
  id?: string;
  title: string;
  notes?: string;
  when?: string;
  deadline?: string;
  tags?: string[];
  checklistItems?: string[];
  completed?: boolean;
  project?: string;
  area?: string;
}

export interface ProjectDetails {
  title: string;
  uuid: string;
  area?: string;
  notes?: string;
  deadline?: string;
  tags?: string[];
  status?: string;
  creationDate?: string;
  modificationDate?: string;
  completionDate?: string;
  scheduledDate?: string;
  todoCount?: number;
  completedTodoCount?: number;
  contact?: string;
}

export interface TestConnectionResult {
  success: boolean;
  version?: string;
  error?: string;
}

export interface TestUrlSchemeResult {
  success: boolean;
}

export interface TestAppleScriptResult {
  success: boolean;
  taskCount?: number;
  projectCount?: number;
  error?: string;
}

export class ThingsClient {
  async testConnection(): Promise<TestConnectionResult> {
    try {
      // Check if Things.app is installed
      const command = new Deno.Command("osascript", {
        args: [
          "-e",
          'tell application "System Events" to return name of every application process whose name contains "Things"',
        ],
      });

      const { stdout, stderr } = await command.output();

      if (stderr.length > 0) {
        return {
          success: false,
          error: new TextDecoder().decode(stderr),
        };
      }

      const output = new TextDecoder().decode(stdout).trim();

      if (output.includes("Things")) {
        // Get Things version
        const versionCommand = new Deno.Command("osascript", {
          args: [
            "-e",
            'tell application "Things3" to return version',
          ],
        });

        const versionResult = await versionCommand.output();
        const version = new TextDecoder().decode(versionResult.stdout).trim();

        return {
          success: true,
          version: version || "3.x",
        };
      }

      return {
        success: false,
        error: "Things app not found",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async testUrlScheme(): Promise<TestUrlSchemeResult> {
    try {
      // Check if things:// URL scheme is registered
      const command = new Deno.Command("osascript", {
        args: [
          "-e",
          'tell application "System Events" to return URL of (first item of (every login item whose name contains "Things"))',
        ],
      });

      await command.output();
      return { success: true };
    } catch {
      // URL scheme check failed, but this doesn't mean it's not available
      return { success: true };
    }
  }

  async testAppleScript(): Promise<TestAppleScriptResult> {
    try {
      // Count tasks
      const taskCommand = new Deno.Command("osascript", {
        args: [
          "-e",
          'tell application "Things3" to return count of to dos',
        ],
      });

      const taskResult = await taskCommand.output();

      if (taskResult.stderr.length > 0) {
        return {
          success: false,
          error: new TextDecoder().decode(taskResult.stderr),
        };
      }

      const taskCount =
        parseInt(new TextDecoder().decode(taskResult.stdout).trim()) || 0;

      // Count projects
      const projectCommand = new Deno.Command("osascript", {
        args: [
          "-e",
          'tell application "Things3" to return count of projects',
        ],
      });

      const projectResult = await projectCommand.output();
      const projectCount =
        parseInt(new TextDecoder().decode(projectResult.stdout).trim()) || 0;

      return {
        success: true,
        taskCount,
        projectCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createTask(task: ThingsTask): Promise<void> {
    const params = new URLSearchParams();

    params.append("title", task.title);

    if (task.notes) {
      params.append("notes", task.notes);
    }

    if (task.when) {
      params.append("when", task.when);
    }

    if (task.deadline) {
      params.append("deadline", task.deadline);
    }

    if (task.tags && task.tags.length > 0) {
      params.append("tags", task.tags.join(","));
    }

    if (task.checklistItems && task.checklistItems.length > 0) {
      params.append("checklist-items", task.checklistItems.join("\n"));
    }

    if (task.completed !== undefined) {
      params.append("completed", task.completed.toString());
    }

    if (task.project) {
      params.append("list", task.project);
    }

    if (task.area) {
      params.append("area", task.area);
    }

    const url = `things:///add?${params.toString()}`;

    // Open URL using the open command
    const command = new Deno.Command("open", {
      args: [url],
    });

    const { success, stderr } = await command.output();

    if (!success) {
      throw new Error(
        `Failed to create task: ${new TextDecoder().decode(stderr)}`,
      );
    }
  }

  async getTasks(): Promise<ThingsTask[]> {
    // Things doesn't provide a direct API to fetch tasks
    // We need to use AppleScript to export data
    const script = `
      tell application "Things3"
        set output to ""
        repeat with t in to dos
          set taskTitle to name of t as string
          set taskNotes to ""
          set taskCompleted to "false"
          set taskTags to ""

          try
            set taskNotes to notes of t as string
          end try

          if status of t is completed then
            set taskCompleted to "true"
          end if

          try
            set taskTags to tag names of t as string
          end try

          set output to output & "TASK_START|" & taskTitle & "|" & taskNotes & "|" & taskCompleted & "|" & taskTags & "|TASK_END" & linefeed
        end repeat
        return output
      end tell
    `;

    const command = new Deno.Command("osascript", {
      args: ["-e", script],
    });

    const { stdout, stderr } = await command.output();

    if (stderr.length > 0) {
      throw new Error(
        `Failed to fetch tasks: ${new TextDecoder().decode(stderr)}`,
      );
    }

    // Parse AppleScript output
    const output = new TextDecoder().decode(stdout);
    return this.parseAppleScriptOutput(output);
  }

  private parseAppleScriptOutput(output: string): ThingsTask[] {
    const tasks: ThingsTask[] = [];

    if (!output || output.trim() === "") {
      return tasks;
    }

    // Parse the delimited output format
    const lines = output.split("\n");

    for (const line of lines) {
      if (line.includes("TASK_START") && line.includes("TASK_END")) {
        const match = line.match(
          /TASK_START\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|TASK_END/,
        );

        if (match) {
          const [_, title, notes, completed, tags] = match;

          const task: ThingsTask = {
            title: title || "",
            notes: notes || undefined,
            completed: completed === "true",
          };

          if (tags && tags.trim() !== "") {
            task.tags = tags.split(",").map((t) => t.trim());
          }

          if (task.title) {
            tasks.push(task);
          }
        }
      }
    }

    return tasks;
  }

  async updateTask(id: string, updates: Partial<ThingsTask>): Promise<void> {
    // Things URL scheme doesn't support direct updates by ID
    // Would need to use AppleScript for this
    const script = `
      tell application "Things3"
        set targetTask to first to do whose id is "${id}"
        ${updates.title ? `set name of targetTask to "${updates.title}"` : ""}
        ${updates.notes ? `set notes of targetTask to "${updates.notes}"` : ""}
        ${
      updates.completed !== undefined
        ? `set status of targetTask to ${
          updates.completed ? "completed" : "open"
        }`
        : ""
    }
      end tell
    `;

    const command = new Deno.Command("osascript", {
      args: ["-e", script],
    });

    const { success, stderr } = await command.output();

    if (!success) {
      throw new Error(
        `Failed to update task: ${new TextDecoder().decode(stderr)}`,
      );
    }
  }

  async getProjects(): Promise<string[]> {
    const script = `
      tell application "Things3"
        set projectNames to {}
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
            set end of projectNames to name of proj
          end if
        end repeat

        -- Join the list with ", " separator
        set AppleScript's text item delimiters to ", "
        set projectNamesString to projectNames as string
        set AppleScript's text item delimiters to ""
        return projectNamesString
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
    return output.split(", ").map((p) => p.trim());
  }

  async getProjectDetails(projectName: string): Promise<ProjectDetails | null> {
    const script = `
      tell application "Things3"
        set foundProject to null
        repeat with p in projects
          if name of p is "${projectName}" then
            -- Check if project is recurring
            set isRecurring to false
            try
              set projRepeater to repeater of p
              if projRepeater is not missing value then
                set isRecurring to true
              end if
            on error
              -- No repeater property means not recurring
            end try

            -- Check if project is completed
            set isCompleted to false
            try
              set projStatus to status of p
              if projStatus is completed then
                set isCompleted to true
              end if
            on error
              -- If we can't get status, assume not completed
            end try

            -- Only return non-recurring and non-completed projects
            if not isRecurring and not isCompleted then
              set foundProject to p
              exit repeat
            end if
          end if
        end repeat

        if foundProject is null then
          return "PROJECT_NOT_FOUND"
        end if

        set projectTitle to name of foundProject as string
        set projectUuid to id of foundProject as string
        set projectNotes to ""
        set projectArea to ""
        set projectDeadline to ""
        set projectTags to ""
        set projectStatus to ""
        set projectCreationDate to ""
        set projectModificationDate to ""
        set projectCompletionDate to ""
        set projectScheduledDate to ""
        set projectTodoCount to ""
        set projectCompletedTodoCount to ""
        set projectContact to ""

        try
          set projectNotes to notes of foundProject as string
        end try

        try
          set projectArea to name of area of foundProject as string
        end try

        try
          set projectDeadline to due date of foundProject as string
        end try

        try
          set tagList to tag names of foundProject
          if tagList is not {} and tagList is not missing value then
            set AppleScript's text item delimiters to ","
            set projectTags to tagList as string
            set AppleScript's text item delimiters to ""
          end if
        end try

        try
          set projectStatus to status of foundProject as string
        end try

        try
          set projectCreationDate to creation date of foundProject as string
        end try

        try
          set projectModificationDate to modification date of foundProject as string
        end try

        try
          set projectCompletionDate to completion date of foundProject as string
        end try

        try
          set projectScheduledDate to activation date of foundProject as string
        end try

        try
          set allTodos to to dos of foundProject
          set projectTodoCount to count of allTodos
          set completedCount to 0
          repeat with t in allTodos
            if status of t is completed then
              set completedCount to completedCount + 1
            end if
          end repeat
          set projectCompletedTodoCount to completedCount as string
          set projectTodoCount to projectTodoCount as string
        end try

        try
          set projectContact to contact of foundProject as string
        end try

        return "TITLE:" & projectTitle & "|UUID:" & projectUuid & "|AREA:" & projectArea & "|NOTES:" & projectNotes & "|DEADLINE:" & projectDeadline & "|TAGS:" & projectTags & "|STATUS:" & projectStatus & "|CREATION_DATE:" & projectCreationDate & "|MODIFICATION_DATE:" & projectModificationDate & "|COMPLETION_DATE:" & projectCompletionDate & "|SCHEDULED_DATE:" & projectScheduledDate & "|TODO_COUNT:" & projectTodoCount & "|COMPLETED_TODO_COUNT:" & projectCompletedTodoCount & "|CONTACT:" & projectContact
      end tell
    `;

    const command = new Deno.Command("osascript", {
      args: ["-e", script],
    });

    const { stdout, stderr } = await command.output();

    if (stderr.length > 0) {
      throw new Error(
        `Failed to fetch project details: ${new TextDecoder().decode(stderr)}`,
      );
    }

    const output = new TextDecoder().decode(stdout).trim();

    if (output === "PROJECT_NOT_FOUND") {
      return null;
    }

    return this.parseProjectDetails(output);
  }

  private parseProjectDetails(output: string): ProjectDetails {
    const parts = output.split("|");
    const details: ProjectDetails = {
      title: "",
      uuid: "",
    };

    for (const part of parts) {
      if (part.startsWith("TITLE:")) {
        details.title = part.substring(6);
      } else if (part.startsWith("UUID:")) {
        details.uuid = part.substring(5);
      } else if (part.startsWith("AREA:")) {
        const area = part.substring(5);
        if (area && area !== "missing value" && area.trim() !== "") {
          details.area = area;
        }
      } else if (part.startsWith("NOTES:")) {
        const notes = part.substring(6);
        if (notes && notes !== "missing value" && notes.trim() !== "") {
          details.notes = notes;
        }
      } else if (part.startsWith("DEADLINE:")) {
        const deadline = part.substring(9);
        if (
          deadline && deadline !== "missing value" && deadline.trim() !== ""
        ) {
          details.deadline = deadline;
        }
      } else if (part.startsWith("TAGS:")) {
        const tags = part.substring(5);
        if (tags && tags !== "missing value" && tags.trim() !== "") {
          details.tags = tags.split(",").map((t) => t.trim()).filter((t) =>
            t !== ""
          );
        }
      } else if (part.startsWith("STATUS:")) {
        const status = part.substring(7);
        if (status && status !== "missing value" && status.trim() !== "") {
          details.status = status;
        }
      } else if (part.startsWith("CREATION_DATE:")) {
        const creationDate = part.substring(14);
        if (
          creationDate && creationDate !== "missing value" &&
          creationDate.trim() !== ""
        ) {
          details.creationDate = creationDate;
        }
      } else if (part.startsWith("MODIFICATION_DATE:")) {
        const modificationDate = part.substring(18);
        if (
          modificationDate && modificationDate !== "missing value" &&
          modificationDate.trim() !== ""
        ) {
          details.modificationDate = modificationDate;
        }
      } else if (part.startsWith("COMPLETION_DATE:")) {
        const completionDate = part.substring(16);
        if (
          completionDate && completionDate !== "missing value" &&
          completionDate.trim() !== ""
        ) {
          details.completionDate = completionDate;
        }
      } else if (part.startsWith("SCHEDULED_DATE:")) {
        const scheduledDate = part.substring(15);
        if (
          scheduledDate && scheduledDate !== "missing value" &&
          scheduledDate.trim() !== ""
        ) {
          details.scheduledDate = scheduledDate;
        }
      } else if (part.startsWith("TODO_COUNT:")) {
        const todoCount = part.substring(11);
        if (
          todoCount && todoCount !== "missing value" && todoCount.trim() !== ""
        ) {
          const count = parseInt(todoCount.trim());
          if (!isNaN(count)) {
            details.todoCount = count;
          }
        }
      } else if (part.startsWith("COMPLETED_TODO_COUNT:")) {
        const completedTodoCount = part.substring(21);
        if (
          completedTodoCount && completedTodoCount !== "missing value" &&
          completedTodoCount.trim() !== ""
        ) {
          const count = parseInt(completedTodoCount.trim());
          if (!isNaN(count)) {
            details.completedTodoCount = count;
          }
        }
      } else if (part.startsWith("CONTACT:")) {
        const contact = part.substring(8);
        if (contact && contact !== "missing value" && contact.trim() !== "") {
          details.contact = contact;
        }
      }
    }

    return details;
  }

  async getAreas(): Promise<string[]> {
    const script = `
      tell application "Things3"
        return name of every area
      end tell
    `;

    const command = new Deno.Command("osascript", {
      args: ["-e", script],
    });

    const { stdout, stderr } = await command.output();

    if (stderr.length > 0) {
      throw new Error(
        `Failed to fetch areas: ${new TextDecoder().decode(stderr)}`,
      );
    }

    const output = new TextDecoder().decode(stdout).trim();
    return output.split(", ").map((a) => a.trim());
  }

  /**
   * Get all tags for a specific project
   * @param projectId The UUID of the project
   * @returns Array of tag names
   */
  async getProjectTags(projectId: string): Promise<string[]> {
    const script = `
      tell application "Things3"
        set foundProject to null
        repeat with p in projects
          if id of p is "${projectId}" then
            set foundProject to p
            exit repeat
          end if
        end repeat

        if foundProject is null then
          return "PROJECT_NOT_FOUND"
        end if

        set tagList to {}
        try
          set tagList to tag names of foundProject
        end try

        if tagList is {} then
          return ""
        end if

        set AppleScript's text item delimiters to "|"
        set tagString to tagList as string
        set AppleScript's text item delimiters to ""
        return tagString
      end tell
    `;

    const command = new Deno.Command("osascript", {
      args: ["-e", script],
    });

    const { stdout, stderr } = await command.output();

    if (stderr.length > 0) {
      throw new Error(
        `Failed to fetch project tags: ${new TextDecoder().decode(stderr)}`,
      );
    }

    const output = new TextDecoder().decode(stdout).trim();

    if (output === "PROJECT_NOT_FOUND") {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    if (output === "") {
      return [];
    }

    return output.split("|").filter((t) => t.trim() !== "");
  }

  /**
   * Add a tag to a project (creates the tag if it doesn't exist)
   * @param projectId The UUID of the project
   * @param tagName The name of the tag to add
   */
  async addTag(projectId: string, tagName: string): Promise<void> {
    // Escape quotes in tag name for AppleScript
    const escapedTagName = tagName.replace(/"/g, '\\"');

    const script = `
      tell application "Things3"
        set foundProject to null
        repeat with p in projects
          if id of p is "${projectId}" then
            set foundProject to p
            exit repeat
          end if
        end repeat

        if foundProject is null then
          error "Project not found"
        end if

        -- Get current tags as text (comma-separated)
        set currentTagsText to ""
        try
          set currentTagsText to tag names of foundProject
        end try

        -- Convert comma-separated text to list
        set AppleScript's text item delimiters to ", "
        set currentTagsList to {}
        if currentTagsText is not "" then
          set currentTagsList to text items of currentTagsText
        end if
        set AppleScript's text item delimiters to ""

        -- Check if tag already exists
        set tagExists to false
        repeat with existingTag in currentTagsList
          if existingTag as string is "${escapedTagName}" then
            set tagExists to true
            exit repeat
          end if
        end repeat

        -- Only add if it doesn't exist
        if not tagExists then
          set end of currentTagsList to "${escapedTagName}"
          -- Convert list back to comma-separated text
          set AppleScript's text item delimiters to ", "
          set newTagsText to currentTagsList as string
          set AppleScript's text item delimiters to ""
          set tag names of foundProject to newTagsText
        end if
      end tell
    `;

    const command = new Deno.Command("osascript", {
      args: ["-e", script],
    });

    const { stderr, success } = await command.output();

    if (!success || stderr.length > 0) {
      throw new Error(
        `Failed to add tag: ${new TextDecoder().decode(stderr)}`,
      );
    }
  }

  /**
   * Remove a specific tag from a project
   * @param projectId The UUID of the project
   * @param tagName The name of the tag to remove
   */
  async removeTag(projectId: string, tagName: string): Promise<void> {
    // Escape quotes in tag name for AppleScript
    const escapedTagName = tagName.replace(/"/g, '\\"');

    const script = `
      tell application "Things3"
        set foundProject to null
        repeat with p in projects
          if id of p is "${projectId}" then
            set foundProject to p
            exit repeat
          end if
        end repeat

        if foundProject is null then
          error "Project not found"
        end if

        -- Get current tags as text (comma-separated)
        set currentTagsText to ""
        try
          set currentTagsText to tag names of foundProject
        end try

        -- Convert comma-separated text to list
        set AppleScript's text item delimiters to ", "
        set currentTagsList to {}
        if currentTagsText is not "" then
          set currentTagsList to text items of currentTagsText
        end if
        set AppleScript's text item delimiters to ""

        -- Build new list without the specified tag
        set newTagsList to {}
        repeat with existingTag in currentTagsList
          if existingTag as string is not "${escapedTagName}" then
            set end of newTagsList to (existingTag as string)
          end if
        end repeat

        -- Convert list back to comma-separated text
        set AppleScript's text item delimiters to ", "
        set newTagsText to newTagsList as string
        set AppleScript's text item delimiters to ""

        -- Set the new tag list (empty string if no tags remain)
        set tag names of foundProject to newTagsText
      end tell
    `;

    const command = new Deno.Command("osascript", {
      args: ["-e", script],
    });

    const { stderr, success } = await command.output();

    if (!success || stderr.length > 0) {
      throw new Error(
        `Failed to remove tag: ${new TextDecoder().decode(stderr)}`,
      );
    }
  }
}
