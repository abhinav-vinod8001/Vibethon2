import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile } from "node:fs/promises";
import { migration, users } from "./database.mjs";

export { users };
export const aiMigration = await readFile(
  new URL(
    "../../supabase/migrations/202610250002_ai_services.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Actual migrations and pgvector; only Supabase's Auth roles are simulated. */
export async function createAiTestDatabase() {
  const db = new PGlite({ extensions: { vector } });
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
    `);
    for (const id of Object.values(users))
      await db.query("insert into auth.users values ($1)", [id]);
    await db.exec(migration);
    await db.exec(aiMigration);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
