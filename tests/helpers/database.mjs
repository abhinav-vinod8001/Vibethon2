import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export const users = {
  employer: "11111111-1111-4111-8111-111111111111",
  candidate: "22222222-2222-4222-8222-222222222222",
  stranger: "33333333-3333-4333-8333-333333333333",
};
export const migration = await readFile(
  new URL(
    "../../supabase/migrations/202610250001_initial_schema.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Test-only Auth schema. Application SQL/RLS/RPCs are the actual migration. */
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
  `);
  for (const id of Object.values(users))
    await db.query("insert into auth.users values ($1)", [id]);
  await db.exec(migration);
  return db;
}
