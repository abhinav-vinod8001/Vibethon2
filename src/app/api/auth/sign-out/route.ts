import { checkOrigin, HttpError, json, route } from "@/server/http";
import { createSupabaseClient } from "@/server/supabase/server";
export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const client = await createSupabaseClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new HttpError(503, "Could not sign out. Please retry.");
    return json({ ok: true });
  });
}
