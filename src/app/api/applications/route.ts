import { z } from "zod";
import {
  body,
  checkOrigin,
  database,
  identity,
  json,
  route,
} from "@/server/http";
export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    await identity();
    const input = z
      .object({
        jobId: z.string().uuid(),
        version: z.number().int().positive(),
        confirmed: z.literal(true),
      })
      .parse(await body(request));
    const application = await (
      await database()
    ).submitApplication(input.jobId, input.version);
    return json({ id: application.id, status: application.status }, 201);
  });
}
export async function PATCH(request: Request) {
  return route(async () => {
    checkOrigin(request);
    await identity();
    const input = z
      .object({
        id: z.string().uuid(),
        status: z.enum(["shortlisted", "contacted", "withdrawn"]),
      })
      .parse(await body(request));
    await (await database()).setApplicationStatus(input.id, input.status);
    return json({ ok: true });
  });
}
