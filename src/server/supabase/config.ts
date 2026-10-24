import { HttpError } from "@/server/errors";

export function supabaseConfig() {
  // Turbopack follows process.env aliases and inlines NEXT_PUBLIC_ values.
  // Reflect keeps these server-only lookups dynamic for standalone deployments.
  const url = runtimeValue("NEXT_PUBLIC_SUPABASE_URL");
  const key = runtimeValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) return null;
  if (!key.startsWith("sb_publishable_"))
    throw new HttpError(
      503,
      "Use the Supabase publishable key, not an admin or legacy key.",
    );
  if (!/^https?:\/\//.test(url))
    throw new HttpError(503, "The Supabase project URL is invalid.");
  return { url, key };
}
function runtimeValue(name: string) {
  const value: unknown = Reflect.get(process.env, name);
  return typeof value === "string" ? value.trim() : "";
}
export function appOrigin() {
  const value =
    process.env.APP_URL?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  if (!value) throw new HttpError(503, "Configure APP_URL before signing in.");
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new HttpError(
      503,
      "APP_URL must be the application's HTTP(S) address.",
    );
  return url.origin;
}
export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.APP_URL?.startsWith("https://") ??
      process.env.NODE_ENV === "production",
    path: "/",
  };
}
