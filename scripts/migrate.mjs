import { createClient } from "@libsql/client";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { databaseConfig } from "../src/server/database-config.mjs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const client = createClient(databaseConfig());
try {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _jobsathi_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  const folder = new URL("../drizzle/", import.meta.url);
  const files = (await readdir(folder))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    const source = (await readFile(new URL(name, folder), "utf8")).replace(
      /\r\n/g,
      "\n",
    );
    const hash = createHash("sha256").update(source).digest("hex");
    const previous = await client.execute({
      sql: "SELECT hash FROM _jobsathi_migrations WHERE name=?",
      args: [name],
    });
    if (previous.rows.length) {
      if (previous.rows[0].hash !== hash)
        throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    const statements = source
      .split("--> statement-breakpoint")
      .map((sql) => sql.trim())
      .filter(Boolean);
    await client.batch(
      [
        ...statements.map((sql) => ({ sql, args: [] })),
        {
          sql: "INSERT INTO _jobsathi_migrations (name,hash,applied_at) VALUES (?,?,?)",
          args: [name, hash, new Date().toISOString()],
        },
      ],
      "write",
    );
    console.log(`Applied ${name}`);
  }
  console.log("Database migrations are up to date.");
} finally {
  client.close();
}
