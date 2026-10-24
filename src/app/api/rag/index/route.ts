import { z } from "zod";
import type { Job } from "@/domain/types";
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
import { indexJob } from "@/server/rag/indexing";

export const maxDuration = 60;

export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const user = await identity();
    const { jobId } = z
      .object({ jobId: z.string().uuid() })
      .strict()
      .parse(await body(request));
    const row = await (await database()).job(jobId);
    if (!row || row.owner_id !== user.userId)
      throw new HttpError(404, "This vacancy is not in your workspace.");
    return json(await indexJob(publicJob(row) as Job));
  });
}
