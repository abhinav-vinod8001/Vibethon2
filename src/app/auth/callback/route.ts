import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/server/supabase/server";
import { appOrigin } from "@/server/supabase/config";
import { route } from "@/server/http";
export async function GET(request: Request) {
  return route(async () => {
    const code = new URL(request.url).searchParams.get("code");
    const target = new URL("/", appOrigin());
    const client = await createSupabaseClient();
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) target.searchParams.set("auth_error", "1");
    } else target.searchParams.set("auth_error", "1");
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}
