import { ConfigManager } from "../config/manager.ts";
import { NocoDBRecord } from "../api/nocodb.ts";
import { ThingsTask } from "../api/things.ts";

export class DataMapper {
  private fieldMappings: Record<string, string>;

  constructor(config: ConfigManager) {
    this.fieldMappings = config.get("fieldMappings") || {};
  }

  thingsToNocoDB(task: ThingsTask): Omit<NocoDBRecord, "id"> {
    const record: any = {};

    // Default mappings
    if (task.title) {
      record.title = task.title;
    }

    if (task.notes !== undefined) {
      record.notes = task.notes;
      record.description = task.notes;
    }

    if (task.completed !== undefined) {
      record.completed = task.completed;
      record.status = task.completed ? "completed" : "pending";
    }

    if (task.when) {
      record.due_date = this.convertThingsWhenToDate(task.when);
    }

    if (task.deadline) {
      record.deadline = task.deadline;
    }

    if (task.tags && task.tags.length > 0) {
      record.tags = task.tags.join(",");
    }

    if (task.project) {
      record.project = task.project;
    }

    if (task.area) {
      record.area = task.area;
    }

    if (task.checklistItems && task.checklistItems.length > 0) {
      record.checklist = task.checklistItems.join("\n");
    }

    // Apply custom field mappings
    for (
      const [thingsField, nocodbField] of Object.entries(this.fieldMappings)
    ) {
      if (task[thingsField as keyof ThingsTask] !== undefined) {
        record[nocodbField] = task[thingsField as keyof ThingsTask];
      }
    }

    return record;
  }

  nocoDBToThings(record: NocoDBRecord): ThingsTask {
    const task: ThingsTask = {
      title: "",
    };

    // Default mappings
    if (record.title) {
      task.title = String(record.title);
    } else if (record.name) {
      task.title = String(record.name);
    }

    if (record.notes) {
      task.notes = String(record.notes);
    } else if (record.description) {
      task.notes = String(record.description);
    }

    if (record.completed !== undefined) {
      task.completed = Boolean(record.completed);
    } else if (record.status) {
      task.completed = String(record.status).toLowerCase() === "completed" ||
        String(record.status).toLowerCase() === "done";
    }

    if (record.due_date) {
      task.when = this.convertDateToThingsWhen(String(record.due_date));
    }

    if (record.deadline) {
      task.deadline = String(record.deadline);
    }

    if (record.tags) {
      if (typeof record.tags === "string") {
        task.tags = record.tags.split(",").map((t) => t.trim());
      } else if (Array.isArray(record.tags)) {
        task.tags = record.tags.map((t) => String(t));
      }
    }

    if (record.project) {
      task.project = String(record.project);
    }

    if (record.area) {
      task.area = String(record.area);
    }

    if (record.checklist) {
      if (typeof record.checklist === "string") {
        task.checklistItems = record.checklist.split("\n").filter((item) =>
          item.trim()
        );
      } else if (Array.isArray(record.checklist)) {
        task.checklistItems = record.checklist.map((item) => String(item));
      }
    }

    // Apply custom field mappings (reverse)
    const reverseMappings = this.getReverseFieldMappings();
    for (const [nocodbField, thingsField] of Object.entries(reverseMappings)) {
      if (record[nocodbField] !== undefined) {
        (task as any)[thingsField] = record[nocodbField];
      }
    }

    return task;
  }

  private getReverseFieldMappings(): Record<string, string> {
    const reverse: Record<string, string> = {};
    for (
      const [thingsField, nocodbField] of Object.entries(this.fieldMappings)
    ) {
      reverse[nocodbField] = thingsField;
    }
    return reverse;
  }

  private convertThingsWhenToDate(when: string): string {
    // Things uses special values like "today", "tomorrow", "evening", etc.
    // Convert these to actual dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (when.toLowerCase()) {
      case "today":
        return today.toISOString().split("T")[0];
      case "tomorrow":
        today.setDate(today.getDate() + 1);
        return today.toISOString().split("T")[0];
      case "evening":
        today.setHours(18, 0, 0, 0);
        return today.toISOString();
      case "anytime":
      case "someday":
        return "";
      default:
        // Try to parse as a date
        try {
          const date = new Date(when);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split("T")[0];
          }
        } catch {
          // Invalid date
        }
        return "";
    }
  }

  private convertDateToThingsWhen(date: string): string {
    if (!date) return "";

    try {
      const d = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);

      const diffTime = d.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return "today";
      } else if (diffDays === 1) {
        return "tomorrow";
      } else if (diffDays > 1 && diffDays <= 7) {
        return d.toLocaleDateString("en-US", { weekday: "long" });
      } else {
        return d.toISOString().split("T")[0];
      }
    } catch {
      return "";
    }
  }
}
