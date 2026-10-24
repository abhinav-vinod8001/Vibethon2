import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Trusted public-content cache/index writes only. Never use for user CRUD. */
export function createAiAdminClient() {
  const rawUrl: unknown = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL");
  const rawKey: unknown = Reflect.get(process.env, "SUPABASE_SECRET_KEY");
  if (typeof rawUrl !== "string" || typeof rawKey !== "string") return null;
  const url = rawUrl.trim();
  const key = rawKey.trim();
  if (!/^https?:\/\//.test(url) || !key.startsWith("sb_secret_")) return null;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.search || parsed.hash)
      return null;
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch(input, init) {
          const timeout = AbortSignal.timeout(10000);
          const signal = init?.signal
            ? AbortSignal.any([init.signal, timeout])
            : timeout;
          return fetch(input, { ...init, signal });
        },
      },
    });
  } catch {
    return null;
  }
}

export function aiStoreConfigured() {
  return createAiAdminClient() !== null;
}
