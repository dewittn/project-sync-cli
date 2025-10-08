import { ensureDir } from "@std/fs/ensure-dir";
import { join } from "@std/path/join";

export interface SyncRecord {
  timestamp: string;
  direction: string;
  itemsSynced: number;
  duration: number;
  errors?: string[];
}

export interface State {
  lastSync?: SyncRecord;
  syncHistory: SyncRecord[];
  statistics: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalItemsSynced: number;
  };
}

export class StateManager {
  private state: State;
  private statePath: string;

  constructor(statePath?: string) {
    const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
    this.statePath = statePath || join(home, ".prjsync", "state.json");
    this.state = {
      syncHistory: [],
      statistics: {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        totalItemsSynced: 0,
      },
    };
  }

  static async load(statePath?: string): Promise<StateManager> {
    const manager = new StateManager(statePath);
    await manager.load();
    return manager;
  }

  async load(): Promise<void> {
    try {
      const data = await Deno.readTextFile(this.statePath);
      this.state = JSON.parse(data);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
      // State file doesn't exist yet, use defaults
    }
  }

  async save(): Promise<void> {
    const dir = this.statePath.substring(0, this.statePath.lastIndexOf("/"));
    await ensureDir(dir);
    await Deno.writeTextFile(
      this.statePath,
      JSON.stringify(this.state, null, 2),
    );
  }

  recordSync(record: SyncRecord): void {
    this.state.lastSync = record;
    this.state.syncHistory.push(record);

    // Keep only last 100 sync records
    if (this.state.syncHistory.length > 100) {
      this.state.syncHistory = this.state.syncHistory.slice(-100);
    }

    // Update statistics
    this.state.statistics.totalSyncs++;
    if (record.errors && record.errors.length > 0) {
      this.state.statistics.failedSyncs++;
    } else {
      this.state.statistics.successfulSyncs++;
    }
    this.state.statistics.totalItemsSynced += record.itemsSynced;
  }

  getLastSync(): SyncRecord | undefined {
    return this.state.lastSync;
  }

  getLastSyncTime(): string | null {
    return this.state.lastSync?.timestamp || null;
  }

  getSyncHistory(limit = 10): SyncRecord[] {
    return this.state.syncHistory.slice(-limit);
  }

  getStatistics(): State["statistics"] {
    return { ...this.state.statistics };
  }

  clear(): void {
    this.state = {
      syncHistory: [],
      statistics: {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        totalItemsSynced: 0,
      },
    };
  }
}
