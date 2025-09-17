import { ensureDir } from "@std/fs/ensure-dir";
import { join } from "@std/path/join";

export interface Config {
  nocodbUrl?: string;
  nocodbToken?: string;
  projectName?: string;
  tableName?: string;
  syncDirection?: "push" | "pull" | "sync";
  autoSync?: boolean;
  syncInterval?: number;
  fieldMappings?: Record<string, string>;
  lastSync?: string;
}

export class ConfigManager {
  private config: Config = {};
  private configPath: string;

  constructor(configPath?: string) {
    const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
    this.configPath = configPath || join(home, ".nocodb-things", "config.json");
  }

  static async load(configPath?: string): Promise<ConfigManager> {
    const manager = new ConfigManager(configPath);
    await manager.load();
    return manager;
  }

  async load(): Promise<void> {
    try {
      const data = await Deno.readTextFile(this.configPath);
      this.config = JSON.parse(data);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
      // Config file doesn't exist yet, use defaults
      this.config = {};
    }
  }

  async save(): Promise<void> {
    const dir = this.configPath.substring(0, this.configPath.lastIndexOf("/"));
    await ensureDir(dir);
    await Deno.writeTextFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
    );
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
  }

  getAll(): Config {
    return { ...this.config };
  }

  isConfigured(): boolean {
    return !!(this.config.nocodbUrl && this.config.nocodbToken);
  }

  async reset(): Promise<void> {
    this.config = {};
    await this.save();
  }
}
