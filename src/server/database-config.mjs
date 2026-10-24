import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Shared by the web server and migration runner; never falls back in production. */
export function databaseConfig() {
  const url =
    process.env.DATABASE_URL ||
    (process.env.NODE_ENV === "production" ? "" : "file:.data/jobsathi.db");
  if (!url) throw new Error("DATABASE_URL must be configured for production.");
  if (url.startsWith("file:") && url !== "file::memory:") {
    const path = url.startsWith("file:///")
      ? fileURLToPath(url)
      : resolve(url.slice(5));
    mkdirSync(dirname(path), { recursive: true });
  }
  return { url, authToken: process.env.DATABASE_AUTH_TOKEN };
}
