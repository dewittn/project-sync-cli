import { ConfigManager } from "../config/manager.ts";
import { NocoDBClient } from "../api/nocodb.ts";
import { ThingsClient } from "../api/things.ts";
import { DataMapper } from "./mapper.ts";
import { ConflictResolver } from "./resolver.ts";
import { StateManager } from "../utils/state.ts";

export interface SyncOptions {
  full?: boolean;
  dryRun?: boolean;
  force?: boolean;
  direction?: "push" | "pull" | "sync";
  filter?: string;
  verbose?: boolean;
}

export interface SyncResult {
  itemsSynced: number;
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
  errors: number;
  duration: number;
}

export class SyncEngine {
  private config: ConfigManager;
  private nocodb: NocoDBClient;
  private things: ThingsClient;
  private mapper: DataMapper;
  private resolver: ConflictResolver;
  private state: StateManager;

  constructor(config: ConfigManager) {
    this.config = config;
    this.nocodb = new NocoDBClient(config);
    this.things = new ThingsClient();
    this.mapper = new DataMapper(config);
    this.resolver = new ConflictResolver();
    this.state = new StateManager();
  }

  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      itemsSynced: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: 0,
      duration: 0,
    };

    try {
      await this.state.load();

      if (options.verbose) {
        console.log("Starting sync process...");
      }

      // Determine sync direction
      const direction = options.direction || this.config.get("syncDirection") ||
        "sync";

      switch (direction) {
        case "push":
          await this.pushToNocoDB(options, result);
          break;
        case "pull":
          await this.pullFromNocoDB(options, result);
          break;
        case "sync":
          await this.bidirectionalSync(options, result);
          break;
      }

      // Update state
      result.duration = Date.now() - startTime;

      await this.state.recordSync({
        timestamp: new Date().toISOString(),
        direction,
        itemsSynced: result.itemsSynced,
        duration: result.duration,
        errors: result.errors > 0
          ? [`${result.errors} errors occurred`]
          : undefined,
      });

      await this.state.save();

      if (options.verbose) {
        console.log(`Sync completed in ${result.duration}ms`);
      }

      return result;
    } catch (error) {
      result.errors++;
      result.duration = Date.now() - startTime;
      throw error;
    }
  }

  private async pushToNocoDB(
    options: SyncOptions,
    result: SyncResult,
  ): Promise<void> {
    if (options.verbose) {
      console.log("Pushing data to NocoDB...");
    }

    // Get tasks from Things
    const thingsTasks = await this.things.getTasks();

    if (options.filter) {
      // Apply filter if provided
      // TODO: Implement filter logic
    }

    for (const task of thingsTasks) {
      try {
        // Map Things task to NocoDB record
        const nocodbRecord = this.mapper.thingsToNocoDB(task);

        if (options.dryRun) {
          console.log(`Would create/update: ${task.title}`);
          continue;
        }

        // Check if record exists in NocoDB (by title or external ID)
        // For now, we'll create new records
        await this.nocodb.createRecord(nocodbRecord);
        result.created++;
        result.itemsSynced++;
      } catch (error) {
        if (options.verbose) {
          console.error(`Error syncing task "${task.title}": ${error.message}`);
        }
        result.errors++;
      }
    }
  }

  private async pullFromNocoDB(
    options: SyncOptions,
    result: SyncResult,
  ): Promise<void> {
    if (options.verbose) {
      console.log("Pulling data from NocoDB...");
    }

    // Get records from NocoDB
    const nocodbRecords = await this.nocodb.getRecords();

    for (const record of nocodbRecords) {
      try {
        // Map NocoDB record to Things task
        const thingsTask = this.mapper.nocoDBToThings(record);

        if (options.dryRun) {
          console.log(`Would create: ${thingsTask.title}`);
          continue;
        }

        // Create task in Things
        await this.things.createTask(thingsTask);
        result.created++;
        result.itemsSynced++;
      } catch (error) {
        if (options.verbose) {
          console.error(
            `Error syncing record "${record.id}": ${error.message}`,
          );
        }
        result.errors++;
      }
    }
  }

  private async bidirectionalSync(
    options: SyncOptions,
    result: SyncResult,
  ): Promise<void> {
    if (options.verbose) {
      console.log("Performing bidirectional sync...");
    }

    // Get data from both sources
    const [nocodbRecords, thingsTasks] = await Promise.all([
      this.nocodb.getRecords(),
      this.things.getTasks(),
    ]);

    // Get last sync timestamp
    const lastSync = options.full ? null : this.state.getLastSyncTime();

    // Process NocoDB records
    for (const record of nocodbRecords) {
      try {
        // Check if record is new or updated since last sync
        if (this.isRecordNewer(record, lastSync)) {
          const thingsTask = this.mapper.nocoDBToThings(record);

          if (options.dryRun) {
            console.log(`Would sync to Things: ${thingsTask.title}`);
            continue;
          }

          // Check for conflicts
          const existingTask = this.findMatchingTask(thingsTask, thingsTasks);

          if (
            existingTask && this.hasConflict(record, existingTask, lastSync)
          ) {
            if (options.force) {
              // Force update
              await this.things.updateTask(existingTask.id!, thingsTask);
              result.updated++;
            } else {
              // Resolve conflict
              const resolved = await this.resolver.resolve(
                record,
                existingTask,
              );
              if (resolved) {
                await this.things.updateTask(existingTask.id!, resolved);
                result.updated++;
              }
              result.conflicts++;
            }
          } else if (!existingTask) {
            // Create new task
            await this.things.createTask(thingsTask);
            result.created++;
          } else {
            // Update existing task
            await this.things.updateTask(existingTask.id!, thingsTask);
            result.updated++;
          }

          result.itemsSynced++;
        }
      } catch (error) {
        if (options.verbose) {
          console.error(
            `Error syncing record "${record.id}": ${error.message}`,
          );
        }
        result.errors++;
      }
    }

    // Process Things tasks
    for (const task of thingsTasks) {
      try {
        // Check if task is new since last sync
        const nocodbRecord = this.mapper.thingsToNocoDB(task);
        const existingRecord = this.findMatchingRecord(
          nocodbRecord,
          nocodbRecords,
        );

        if (!existingRecord) {
          if (options.dryRun) {
            console.log(`Would sync to NocoDB: ${task.title}`);
            continue;
          }

          // Create new record
          await this.nocodb.createRecord(nocodbRecord);
          result.created++;
          result.itemsSynced++;
        }
      } catch (error) {
        if (options.verbose) {
          console.error(`Error syncing task "${task.title}": ${error.message}`);
        }
        result.errors++;
      }
    }
  }

  private isRecordNewer(record: any, lastSync: string | null): boolean {
    if (!lastSync) return true;

    const recordUpdated = record.updated_at || record.created_at;
    if (!recordUpdated) return true;

    return new Date(recordUpdated) > new Date(lastSync);
  }

  private findMatchingTask(task: any, tasks: any[]): any {
    return tasks.find((t) => t.title === task.title);
  }

  private findMatchingRecord(record: any, records: any[]): any {
    return records.find((r) => r.title === record.title);
  }

  private hasConflict(
    record: any,
    task: any,
    lastSync: string | null,
  ): boolean {
    if (!lastSync) return false;

    const recordUpdated = record.updated_at || record.created_at;
    // Since Things doesn't provide modification timestamps,
    // we'll need to compare content or use checksums
    return recordUpdated && new Date(recordUpdated) > new Date(lastSync);
  }
}
