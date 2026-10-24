import { checkOrigin, HttpError, json, route } from "@/server/http";
import { createSupabaseClient } from "@/server/supabase/server";
import { appOrigin } from "@/server/supabase/config";
export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const client = await createSupabaseClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appOrigin()}/auth/callback`,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url)
      throw new HttpError(
        503,
        "Google sign-in is unavailable. Check the Supabase Google provider setup.",
      );
    return json({ url: data.url });
  });
}
