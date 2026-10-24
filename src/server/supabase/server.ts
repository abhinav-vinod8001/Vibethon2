import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { HttpError } from "@/server/errors";
import { supabaseConfig, authCookieOptions } from "./config";
import type { Database } from "./types";

/** A new client for each request; user sessions are never shared globally. */
export async function createSupabaseClient() {
  const config = supabaseConfig();
  if (!config) throw new HttpError(503, "Supabase is not configured yet.");
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values)
          store.set(name, value, options);
      },
    },
  });
}
