import { ConfigManager } from "../config/manager.ts";

export interface NocoDBRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * Custom error class that includes detailed HTTP request/response information
 */
export class NocoDBHTTPError extends Error {
  public readonly method: string;
  public readonly url: string;
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly requestHeaders: Record<string, string>;
  public readonly requestBody?: string;
  public readonly responseBody?: string;
  public readonly responseHeaders: Record<string, string>;

  constructor(
    message: string,
    options: {
      method: string;
      url: string;
      statusCode: number;
      statusText: string;
      requestHeaders: Record<string, string>;
      requestBody?: string;
      responseBody?: string;
      responseHeaders: Record<string, string>;
    },
  ) {
    super(message);
    this.name = "NocoDBHTTPError";
    this.method = options.method;
    this.url = options.url;
    this.statusCode = options.statusCode;
    this.statusText = options.statusText;
    this.requestHeaders = options.requestHeaders;
    this.requestBody = options.requestBody;
    this.responseBody = options.responseBody;
    this.responseHeaders = options.responseHeaders;
  }

  /**
   * Get a sanitized copy of headers (hides sensitive tokens)
   */
  private sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const sanitized = { ...headers };
    if (sanitized["xc-token"]) {
      sanitized["xc-token"] = `${sanitized["xc-token"].substring(0, 8)}...`;
    }
    if (sanitized["authorization"]) {
      sanitized["authorization"] = "***";
    }
    return sanitized;
  }

  /**
   * Format the error as a detailed, readable string
   */
  toDetailedString(): string {
    const lines: string[] = [];
    lines.push(`❌ ${this.message}`);
    lines.push("");
    lines.push("HTTP Request Details:");
    lines.push(`  Method: ${this.method}`);
    lines.push(`  URL: ${this.url}`);
    lines.push(`  Headers:`);
    const sanitizedReqHeaders = this.sanitizeHeaders(this.requestHeaders);
    for (const [key, value] of Object.entries(sanitizedReqHeaders)) {
      lines.push(`    ${key}: ${value}`);
    }
    if (this.requestBody) {
      lines.push(`  Body:`);
      // Try to format JSON nicely
      try {
        const parsed = JSON.parse(this.requestBody);
        lines.push(
          `    ${JSON.stringify(parsed, null, 2).replace(/\n/g, "\n    ")}`,
        );
      } catch {
        lines.push(`    ${this.requestBody}`);
      }
    }
    lines.push("");
    lines.push("HTTP Response:");
    lines.push(`  Status: ${this.statusCode} ${this.statusText}`);
    lines.push(`  Headers:`);
    for (const [key, value] of Object.entries(this.responseHeaders)) {
      lines.push(`    ${key}: ${value}`);
    }
    if (this.responseBody) {
      lines.push(`  Body:`);
      // Try to format JSON nicely
      try {
        const parsed = JSON.parse(this.responseBody);
        lines.push(
          `    ${JSON.stringify(parsed, null, 2).replace(/\n/g, "\n    ")}`,
        );
      } catch {
        lines.push(`    ${this.responseBody}`);
      }
    }
    return lines.join("\n");
  }
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
  private primaryKeyField?: string;

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

  /**
   * Helper method to make HTTP requests with detailed error handling
   */
  private async fetchWithErrorHandling(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const method = options.method || "GET";
    const headers = {
      "xc-token": this.token,
      ...options.headers,
    };

    const requestBody = options.body ? String(options.body) : undefined;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        // Capture response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Capture response body
        const responseBody = await response.text();

        // Parse error message from response if available
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = JSON.parse(responseBody);
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.msg) {
            errorMessage = errorData.msg;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Response wasn't JSON, use the raw text if available
          if (responseBody && responseBody.length < 500) {
            errorMessage += `: ${responseBody}`;
          }
        }

        throw new NocoDBHTTPError(errorMessage, {
          method,
          url,
          statusCode: response.status,
          statusText: response.statusText,
          requestHeaders: headers as Record<string, string>,
          requestBody,
          responseBody,
          responseHeaders,
        });
      }

      return response;
    } catch (error) {
      // If it's already a NocoDBHTTPError, just re-throw it
      if (error instanceof NocoDBHTTPError) {
        throw error;
      }

      // Otherwise, wrap network errors in a descriptive error
      throw new Error(
        `Network error while ${method} ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
          error: `Failed to resolve table ID: ${
            error instanceof Error ? error.message : String(error)
          }`,
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

  async getRecords(
    onProgress?: (fetched: number, batch: number) => void,
  ): Promise<NocoDBRecord[]> {
    await this.ensureTableId();

    const allRecords: NocoDBRecord[] = [];
    const limit = 100;
    let offset = 0;
    let hasMore = true;
    let requestCount = 0;

    while (hasMore) {
      requestCount++;
      const url =
        `${this.baseUrl}/api/v2/tables/${this.tableId}/records?limit=${limit}&offset=${offset}`;
      const response = await this.fetchWithErrorHandling(url);

      const data = await response.json();
      const batch = data.list || [];

      allRecords.push(...batch);

      // Call progress callback if provided
      if (onProgress) {
        onProgress(allRecords.length, batch.length);
      }

      // If we got fewer records than the limit, we've reached the end
      hasMore = batch.length === limit;
      offset += limit;
    }

    return allRecords;
  }

  async createRecord(record: Omit<NocoDBRecord, "id">): Promise<NocoDBRecord> {
    await this.ensureTableId();

    // Validate and clean the record data
    const cleanedRecord = this.validateAndCleanRecord(record);

    const url = `${this.baseUrl}/api/v2/tables/${this.tableId}/records`;
    const response = await this.fetchWithErrorHandling(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cleanedRecord),
    });

    return await response.json();
  }

  private validateAndCleanRecord(
    record: Omit<NocoDBRecord, "id">,
  ): Omit<NocoDBRecord, "id"> {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      // Skip undefined or null values
      if (value === undefined || value === null) {
        continue;
      }

      // Handle different value types appropriately
      if (typeof value === "string") {
        // Include all strings, even empty ones (to allow clearing fields)
        // Just trim whitespace from non-empty strings
        cleaned[key] = value.trim();
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
    await this.ensurePrimaryKeyField();

    // Validate and clean the update data
    const cleanedUpdates = this.validateAndCleanRecord(updates);

    // Use batch endpoint with array format - NocoDB expects array even for single record
    const payload = [{ [this.primaryKeyField!]: id, ...cleanedUpdates }];

    const url = `${this.baseUrl}/api/v2/tables/${this.tableId}/records`;
    const response = await this.fetchWithErrorHandling(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result[0] || result;
  }

  async deleteRecord(id: string): Promise<void> {
    await this.ensureTableId();
    await this.ensurePrimaryKeyField();

    const url = `${this.baseUrl}/api/v2/tables/${this.tableId}/records`;
    await this.fetchWithErrorHandling(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ [this.primaryKeyField!]: id }]),
    });
  }

  async getRecordById(id: string): Promise<NocoDBRecord | null> {
    await this.ensureTableId();

    const url =
      `${this.baseUrl}/api/v2/tables/${this.tableId}/records?where=(Id,eq,${id})&limit=1`;

    try {
      const response = await this.fetchWithErrorHandling(url);
      const data = await response.json();
      const records = data.list || [];
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      // If it's a 404, return null instead of throwing
      if (error instanceof NocoDBHTTPError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getTableSchema(): Promise<Record<string, unknown>> {
    await this.ensureTableId();

    const url = `${this.baseUrl}/api/v2/meta/tables/${this.tableId}`;
    const response = await this.fetchWithErrorHandling(url);
    return await response.json();
  }

  /**
   * Get valid options for a select/multi-select field
   * @param fieldName The title/name of the field
   * @returns Array of valid option values, or null if field not found or has no options
   */
  async getFieldOptions(fieldName: string): Promise<string[] | null> {
    await this.ensureTableId();

    const schema = await this.getTableSchema();
    const columns = schema.columns as Array<{
      title: string;
      uidt?: string; // UI data type
      colOptions?: {
        options?: Array<{ title: string; order?: number }>;
      };
    }>;

    if (!columns || columns.length === 0) {
      return null;
    }

    // Find the column by title
    const column = columns.find((col) => col.title === fieldName);

    if (!column) {
      return null;
    }

    // Check if it's a select or multi-select field
    if (
      column.uidt !== "SingleSelect" && column.uidt !== "MultiSelect"
    ) {
      return null;
    }

    // Extract options
    const options = column.colOptions?.options;
    if (!options || options.length === 0) {
      return [];
    }

    // Return just the titles/values of the options
    return options.map((opt) => opt.title);
  }

  async getRecordId(record: NocoDBRecord): Promise<string> {
    await this.ensurePrimaryKeyField();

    const id = record[this.primaryKeyField!];

    if (!id) {
      throw new Error(
        `Record does not have a value for primary key field '${this.primaryKeyField}'. Available fields: ${
          Object.keys(record).join(", ")
        }`,
      );
    }

    return String(id);
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

  private async ensurePrimaryKeyField(): Promise<void> {
    if (this.primaryKeyField) {
      return;
    }

    await this.ensureTableId();

    // Fetch table schema to get primary key field
    const schema = await this.getTableSchema();
    const columns = schema.columns as Array<{
      title: string;
      column_name?: string;
      pk?: boolean;
      pv?: boolean;
    }>;

    if (!columns || columns.length === 0) {
      throw new Error("No columns found in table schema");
    }

    // Find the primary key column
    const pkColumn = columns.find((col) => col.pk === true);

    if (!pkColumn) {
      throw new Error(
        "No primary key found in table. Please ensure your NocoDB table has a primary key defined.",
      );
    }

    // Use the title (display name) as the field name for API operations
    this.primaryKeyField = pkColumn.title;
  }

  private async resolveIds(): Promise<void> {
    if (!this.projectName || !this.tableName) {
      throw new Error(
        "Project name and table name must be configured to resolve IDs",
      );
    }

    // First, get all bases to find the base ID
    if (!this.baseId) {
      const basesUrl = `${this.baseUrl}/api/v2/meta/bases`;
      const basesResponse = await this.fetchWithErrorHandling(basesUrl);

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
    const tablesUrl = `${this.baseUrl}/api/v2/meta/bases/${this.baseId}/tables`;
    const tablesResponse = await this.fetchWithErrorHandling(tablesUrl);

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
