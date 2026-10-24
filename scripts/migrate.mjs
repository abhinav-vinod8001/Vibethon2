import postgres from "postgres";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"])
  if (existsSync(file)) process.loadEnvFile(file);
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "Set SUPABASE_DB_URL to the Supabase session-pooler connection, or apply the SQL in the Supabase SQL Editor.",
  );
  process.exitCode = 1;
} else {
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    ssl: "require",
    onnotice: () => {},
  });
  try {
    await sql.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(726192045)`;
      await transaction.unsafe(`create schema if not exists jobsathi_migrations;
        revoke all on schema jobsathi_migrations from public, anon, authenticated;
        create table if not exists jobsathi_migrations.applied (
          name text primary key, hash text not null, applied_at timestamptz not null default now()
        );
        revoke all on table jobsathi_migrations.applied from public, anon, authenticated;`);
      const folder = new URL("../supabase/migrations/", import.meta.url);
      for (const name of (await readdir(folder))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        const source = (await readFile(new URL(name, folder), "utf8")).replace(
          /\r\n/g,
          "\n",
        );
        const hash = createHash("sha256").update(source).digest("hex");
        const [previous] =
          await transaction`select hash from jobsathi_migrations.applied where name=${name}`;
        if (previous) {
          if (previous.hash !== hash)
            throw new Error(`Applied migration changed: ${name}`);
          continue;
        }
        // SQL Editor files contain their own wrapper; the runner owns this transaction.
        await transaction.unsafe(
          source.replace(/^begin;\s*$/m, "").replace(/^commit;\s*$/m, ""),
        );
        await transaction`insert into jobsathi_migrations.applied(name,hash) values (${name},${hash})`;
        console.log(`Applied ${name}`);
      }
    });
    console.log("Supabase migrations are up to date.");
  } catch (error) {
    console.error(
      error.message?.startsWith("Applied migration changed:")
        ? error.message
        : `Migration failed (${error.code || "connection error"}). Check credentials/schema. If you already applied the initial SQL in the dashboard, do not apply it again with this runner.`,
    );
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
