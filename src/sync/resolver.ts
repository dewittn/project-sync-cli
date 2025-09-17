import { NocoDBRecord } from "../api/nocodb.ts";
import { ThingsTask } from "../api/things.ts";

export class ConflictResolver {
  async resolve(
    nocodbRecord: NocoDBRecord,
    thingsTask: ThingsTask,
  ): Promise<ThingsTask | null> {
    // Simple conflict resolution strategy
    // Can be enhanced with user prompts or more sophisticated logic

    // Strategy 1: Most recently updated wins
    // Since Things doesn't provide update timestamps, we'll use NocoDB's timestamp
    // and assume it's more recent if it has an updated_at field

    if (nocodbRecord.updated_at) {
      // NocoDB record is probably newer, use its data
      return {
        ...thingsTask,
        title: String(nocodbRecord.title || thingsTask.title),
        notes: nocodbRecord.notes
          ? String(nocodbRecord.notes)
          : thingsTask.notes,
        completed: nocodbRecord.completed !== undefined
          ? Boolean(nocodbRecord.completed)
          : thingsTask.completed,
      };
    }

    // Strategy 2: Merge non-conflicting fields
    const merged: ThingsTask = { ...thingsTask };

    // If titles differ, prefer the longer one (assuming more detail is better)
    if (nocodbRecord.title && String(nocodbRecord.title) !== thingsTask.title) {
      merged.title = String(nocodbRecord.title).length > thingsTask.title.length
        ? String(nocodbRecord.title)
        : thingsTask.title;
    }

    // Merge notes by concatenating if they're different
    if (nocodbRecord.notes && String(nocodbRecord.notes) !== thingsTask.notes) {
      if (
        thingsTask.notes &&
        !String(nocodbRecord.notes).includes(thingsTask.notes)
      ) {
        merged.notes = `${thingsTask.notes}\n\n---\n\n${nocodbRecord.notes}`;
      } else {
        merged.notes = String(nocodbRecord.notes);
      }
    }

    // For completion status, prefer completed over incomplete
    if (nocodbRecord.completed !== undefined) {
      merged.completed = Boolean(nocodbRecord.completed) ||
        thingsTask.completed;
    }

    return merged;
  }

  async resolveWithUserInput(
    nocodbRecord: NocoDBRecord,
    thingsTask: ThingsTask,
  ): Promise<ThingsTask | null> {
    console.log("\n🔄 Conflict detected:");
    console.log("─".repeat(50));

    console.log("\nNocoDB Record:");
    console.log(`  Title: ${nocodbRecord.title}`);
    console.log(`  Notes: ${nocodbRecord.notes || "(empty)"}`);
    console.log(`  Completed: ${nocodbRecord.completed}`);

    console.log("\nThings Task:");
    console.log(`  Title: ${thingsTask.title}`);
    console.log(`  Notes: ${thingsTask.notes || "(empty)"}`);
    console.log(`  Completed: ${thingsTask.completed}`);

    const choice = prompt(
      "\nResolve conflict - Choose (1) NocoDB, (2) Things, (3) Skip:",
    );

    switch (choice) {
      case "1":
        // Use NocoDB data
        return {
          ...thingsTask,
          title: String(nocodbRecord.title || thingsTask.title),
          notes: nocodbRecord.notes
            ? String(nocodbRecord.notes)
            : thingsTask.notes,
          completed: nocodbRecord.completed !== undefined
            ? Boolean(nocodbRecord.completed)
            : thingsTask.completed,
        };

      case "2":
        // Keep Things data as is
        return thingsTask;

      case "3":
      default:
        // Skip this item
        return null;
    }
  }
}
