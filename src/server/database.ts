import { createClient, type Client, type InValue } from "@libsql/client";
import { databaseConfig } from "./database-config.mjs";

let client: Client | undefined;

function connection() {
  client ??= createClient(databaseConfig());
  return client;
}

function parameter(value: unknown): InValue {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint"
  )
    return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  throw new TypeError("Unsupported SQL parameter");
}

/** Keep parameterized SQL in route handlers independent of the deployment platform. */
class Statement {
  constructor(
    private sql: string,
    private args: InValue[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new Statement(this.sql, values.map(parameter));
  }

  async first(): Promise<Record<string, unknown> | null> {
    const result = await connection().execute({
      sql: this.sql,
      args: this.args,
    });
    return result.rows[0] ?? null;
  }

  async all(): Promise<{ results: Record<string, unknown>[] }> {
    const result = await connection().execute({
      sql: this.sql,
      args: this.args,
    });
    return { results: result.rows };
  }

  async run() {
    const result = await connection().execute({
      sql: this.sql,
      args: this.args,
    });
    return { meta: { changes: result.rowsAffected } };
  }
}

export function getDatabase() {
  return { prepare: (sql: string) => new Statement(sql) };
}
