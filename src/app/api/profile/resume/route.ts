import {
  database,
  HttpError,
  identity,
  profileFromRow,
  route,
} from "@/server/http";
import { profileSchema } from "@/domain/validation";
import { createResumePdf } from "@/server/resume";
import { requestLocale } from "@/server/language";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return route(async () => {
    const user = await identity();
    const row = await (await database()).profile(user.userId);
    if (!row)
      throw new HttpError(
        404,
        "Save and confirm your profile before downloading a resume.",
      );
    const profile = profileSchema.parse(profileFromRow(row));
    const locale = await requestLocale(
      new URL(request.url).searchParams.get("locale") ?? undefined,
    );
    const bytes = await createResumePdf(profile, locale);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="jobsathi-resume.pdf"',
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
