import { createSupabaseClient } from "./supabase/server";
import { supabaseConfig } from "./supabase/config";
import { HttpError } from "./errors";

/** Verify identity with Supabase Auth; never trust a user object from a cookie. */
export async function currentUser() {
  if (!supabaseConfig()) return null;
  const client = await createSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (
      error.status === 0 ||
      error.status === 429 ||
      (error.status && error.status >= 500) ||
      error.name === "AuthRetryableFetchError"
    )
      throw new HttpError(
        503,
        "Sign-in is temporarily unavailable. Please retry.",
      );
    return null;
  }
  if (!data.user) return null;
  const name: unknown =
    data.user.user_metadata?.full_name ?? data.user.user_metadata?.name;
  return {
    userId: data.user.id,
    displayName: typeof name === "string" ? name : "JobSathi member",
  };
}
