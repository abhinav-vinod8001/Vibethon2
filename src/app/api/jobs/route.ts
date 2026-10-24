import { z } from "zod";
import { jobSchema } from "@/domain/validation";
import {
  body,
  checkOrigin,
  database,
  HttpError,
  identity,
  json,
  publicJob,
  route,
} from "@/server/http";
export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    await identity();
    const input = jobSchema.parse(await body(request));
    if (
      input.deadline &&
      (Number.isNaN(Date.parse(input.deadline)) ||
        new Date(input.deadline).toISOString().slice(0, 10) !==
          input.deadline ||
        input.deadline < new Date().toISOString().slice(0, 10))
    )
      throw new HttpError(
        400,
        "Choose a valid application deadline today or later.",
      );
    const job = await (await database()).createJob(input);
    // Semantic search generates vectors on demand; user RPCs cannot write trusted embeddings.
    return json({ job: publicJob(job), indexed: false }, 201);
  });
}
export async function PATCH(request: Request) {
  return route(async () => {
    checkOrigin(request);
    await identity();
    const input = z
      .object({ id: z.string().uuid(), status: z.enum(["active", "closed"]) })
      .parse(await body(request));
    await (await database()).setJobStatus(input.id, input.status);
    return json({ ok: true });
  });
}
