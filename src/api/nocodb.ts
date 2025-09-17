import { ConfigManager } from "../config/manager.ts";

export interface NocoDBRecord {
  id: string;
  [key: string]: unknown;
}

export interface TestConnectionResult {
  success: boolean;
  version?: string;
  projectCount?: number;
  error?: string;
}

export interface TestTableResult {
  success: boolean;
  columnCount?: number;
  recordCount?: number;
  error?: string;
}

export class NocoDBClient {
  private baseUrl: string;
  private token: string;
  private projectName?: string;
  private tableName?: string;
  private baseId?: string;
  private tableId?: string;

  constructor(config: ConfigManager) {
    const url = config.get("nocodbUrl");
    const token = config.get("nocodbToken");

    if (!url || !token) {
      throw new Error("NocoDB configuration missing");
    }

    this.baseUrl = url;
    this.token = token;
    this.projectName = config.get("projectName");
    this.tableName = config.get("tableName");
    this.baseId = config.get("baseId");
    this.tableId = config.get("tableId");
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/meta/bases`, {
        headers: {
          "xc-token": this.token,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        version: data.version || "unknown",
        projectCount: data.list?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async testTable(): Promise<TestTableResult> {
    if (!this.tableId) {
      if (!this.projectName || !this.tableName) {
        return {
          success: false,
          error: "Project name and table name, or table ID must be configured",
        };
      }

      // Try to resolve table ID if not provided
      try {
        await this.resolveIds();
      } catch (error) {
        return {
          success: false,
          error: `Failed to resolve table ID: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    try {
      // Get table info using v2 API
      const tableResponse = await fetch(
        `${this.baseUrl}/api/v2/meta/tables/${this.tableId}`,
        {
          headers: {
            "xc-token": this.token,
          },
        },
      );

      if (!tableResponse.ok) {
        return {
          success: false,
          error: `Table not found: HTTP ${tableResponse.status}`,
        };
      }

      const tableInfo = await tableResponse.json();

      // Get record count using v2 API
      const countResponse = await fetch(
        `${this.baseUrl}/api/v2/tables/${this.tableId}/records/count`,
        {
          headers: {
            "xc-token": this.token,
          },
        },
      );

      let recordCount = 0;
      if (countResponse.ok) {
        const countData = await countResponse.json();
        recordCount = countData.count || 0;
      }

      return {
        success: true,
        columnCount: tableInfo.columns?.length || 0,
        recordCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getRecords(limit = 100, offset = 0): Promise<NocoDBRecord[]> {
    await this.ensureTableId();

    const response = await fetch(
      `${this.baseUrl}/api/v2/tables/${this.tableId}/records?limit=${limit}&offset=${offset}`,
      {
        headers: {
          "xc-token": this.token,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch records: ${response.statusText}`);
    }

    const data = await response.json();
    return data.list || [];
  }

  async createRecord(record: Omit<NocoDBRecord, "id">): Promise<NocoDBRecord> {
    await this.ensureTableId();

    // Validate and clean the record data
    const cleanedRecord = this.validateAndCleanRecord(record);

    const response = await fetch(
      `${this.baseUrl}/api/v2/tables/${this.tableId}/records`,
      {
        method: "POST",
        headers: {
          "xc-token": this.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanedRecord),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to create record: ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        }
        if (errorData.details) {
          errorMessage += ` - Details: ${JSON.stringify(errorData.details)}`;
        }
      } catch {
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      // Add debug information about the request
      errorMessage += `\nRequest URL: ${this.baseUrl}/api/v2/tables/${this.tableId}/records`;
      errorMessage += `\nRequest payload: ${JSON.stringify(cleanedRecord, null, 2)}`;

      throw new Error(errorMessage);
    }

    return await response.json();
  }

  private validateAndCleanRecord(record: Omit<NocoDBRecord, "id">): Omit<NocoDBRecord, "id"> {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      // Skip undefined or null values
      if (value === undefined || value === null) {
        continue;
      }

      // Handle different value types appropriately
      if (typeof value === "string") {
        // Only include non-empty strings
        if (value.trim() !== "") {
          cleaned[key] = value.trim();
        }
      } else if (typeof value === "number") {
        cleaned[key] = value;
      } else if (typeof value === "boolean") {
        cleaned[key] = value;
      } else if (value instanceof Date) {
        cleaned[key] = value.toISOString();
      } else if (typeof value === "object") {
        // Convert objects to JSON strings if they're not null
        cleaned[key] = JSON.stringify(value);
      } else {
        // Convert other types to strings
        cleaned[key] = String(value);
      }
    }

    return cleaned;
  }

  async updateRecord(
    id: string,
    updates: Partial<NocoDBRecord>,
  ): Promise<NocoDBRecord> {
    await this.ensureTableId();

    // Validate and clean the update data
    const cleanedUpdates = this.validateAndCleanRecord(updates);
    const payload = [{ Id: id, ...cleanedUpdates }];

    const response = await fetch(
      `${this.baseUrl}/api/v2/tables/${this.tableId}/records`,
      {
        method: "PATCH",
        headers: {
          "xc-token": this.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to update record: ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        }
        if (errorData.details) {
          errorMessage += ` - Details: ${JSON.stringify(errorData.details)}`;
        }
      } catch {
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      // Add debug information about the request
      errorMessage += `\nRequest URL: ${this.baseUrl}/api/v2/tables/${this.tableId}/records`;
      errorMessage += `\nRequest payload: ${JSON.stringify(payload, null, 2)}`;

      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result[0] || result;
  }

  async deleteRecord(id: string): Promise<void> {
    await this.ensureTableId();

    const response = await fetch(
      `${this.baseUrl}/api/v2/tables/${this.tableId}/records`,
      {
        method: "DELETE",
        headers: {
          "xc-token": this.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ Id: id }]),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to delete record: ${response.statusText}`);
    }
  }

  async getRecordById(id: string): Promise<NocoDBRecord | null> {
    await this.ensureTableId();

    const response = await fetch(
      `${this.baseUrl}/api/v2/tables/${this.tableId}/records?where=(Id,eq,${id})&limit=1`,
      {
        headers: {
          "xc-token": this.token,
        },
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch record: ${response.statusText}`);
    }

    const data = await response.json();
    const records = data.list || [];
    return records.length > 0 ? records[0] : null;
  }

  async getTableSchema(): Promise<Record<string, unknown>> {
    await this.ensureTableId();

    const response = await fetch(
      `${this.baseUrl}/api/v2/meta/tables/${this.tableId}`,
      {
        headers: {
          "xc-token": this.token,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch table schema: ${response.statusText}`);
    }

    return await response.json();
  }

  private async ensureTableId(): Promise<void> {
    if (!this.tableId) {
      if (!this.projectName || !this.tableName) {
        throw new Error(
          "Project name and table name, or table ID must be configured",
        );
      }
      await this.resolveIds();
    }
  }

  private async resolveIds(): Promise<void> {
    if (!this.projectName || !this.tableName) {
      throw new Error(
        "Project name and table name must be configured to resolve IDs",
      );
    }

    // First, get all bases to find the base ID
    if (!this.baseId) {
      const basesResponse = await fetch(`${this.baseUrl}/api/v2/meta/bases`, {
        headers: {
          "xc-token": this.token,
        },
      });

      if (!basesResponse.ok) {
        throw new Error(`Failed to fetch bases: ${basesResponse.statusText}`);
      }

      const basesData = await basesResponse.json();
      const bases = basesData.list || [];
      const matchingBase = bases.find((
        base: { title: string; alias: string; id: string },
      ) => base.title === this.projectName || base.alias === this.projectName);

      if (!matchingBase) {
        throw new Error(`Base with name '${this.projectName}' not found`);
      }

      this.baseId = matchingBase.id;
    }

    // Then, get tables for this base to find the table ID
    const tablesResponse = await fetch(
      `${this.baseUrl}/api/v2/meta/bases/${this.baseId}/tables`,
      {
        headers: {
          "xc-token": this.token,
        },
      },
    );

    if (!tablesResponse.ok) {
      throw new Error(`Failed to fetch tables: ${tablesResponse.statusText}`);
    }

    const tablesData = await tablesResponse.json();
    const tables = tablesData.list || [];
    const matchingTable = tables.find((
      table: { title: string; table_name: string; id: string },
    ) => table.title === this.tableName || table.table_name === this.tableName);

    if (!matchingTable) {
      throw new Error(
        `Table with name '${this.tableName}' not found in base '${this.projectName}'`,
      );
    }

    this.tableId = matchingTable.id;
  }
}
