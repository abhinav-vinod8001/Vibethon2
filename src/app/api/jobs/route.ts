import { z } from "zod";
import { jobSchema } from "@/domain/validation";
import type { Job } from "@/domain/types";
import { indexJob } from "@/server/rag/indexing";
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
export const maxDuration = 60;
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
    const result = await indexJob(publicJob(job) as Job);
    // Await bounded provider work so Vercel may safely end the function afterwards.
    // A missing index never rolls back an otherwise successful vacancy submission.
    return json(
      { job: publicJob(job), indexed: result.indexed, indexing: result.status },
      201,
    );
  });
}
export async function PATCH(request: Request) {
  return route(async () => {
    checkOrigin(request);
    await identity();
    const input = z
      .object({ id: z.string().uuid(), status: z.enum(["active", "closed"]) })
      .parse(await body(request));
    const job = await (await database()).setJobStatus(input.id, input.status);
    if (input.status === "active") {
      const result = await indexJob(publicJob(job) as Job);
      return json({
        ok: true,
        indexed: result.indexed,
        indexing: result.status,
      });
    }
    return json({ ok: true, indexed: false, indexing: "closed" });
  });
}
