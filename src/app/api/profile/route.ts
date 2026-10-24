import {
  body,
  checkOrigin,
  database,
  HttpError,
  identity,
  json,
  route,
} from "@/server/http";
import { profileSchema } from "@/domain/validation";
export async function PUT(request: Request) {
  return route(async () => {
    checkOrigin(request);
    await identity();
    const input = await body(request);
    if (input.confirmed !== true)
      throw new HttpError(
        400,
        "Please review and confirm your profile before saving.",
      );
    const profile = profileSchema.parse(input.profile);
    await (await database()).saveProfile(profile);
    return json({ profile });
  });
}
