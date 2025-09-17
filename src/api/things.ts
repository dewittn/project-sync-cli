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
        error: error.message,
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
        error: error.message,
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
        return name of every project
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
}
