import { z } from "zod";
import { profileText } from "@/domain/matching";
import { retrieveJobs } from "@/server/rag/retrieval";
import {
  body,
  checkOrigin,
  database,
  identity,
  json,
  profileFromRow,
  route,
} from "@/server/http";
import type { Profile } from "@/domain/types";
export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const user = await identity();
    const input = z
      .object({
        query: z.string().max(1000).default(""),
        location: z.string().max(100).default(""),
        category: z.string().max(50).default(""),
        type: z.string().max(50).default(""),
        includeSamples: z.boolean().default(true),
      })
      .parse(await body(request));
    const db = await database();
    const p = await db.profile(user.userId);
    const query =
      input.query || (p ? profileText(profileFromRow(p) as Profile) : "");
    const result = await retrieveJobs({
      ...input,
      query,
      userId: user.userId,
      limit: 20,
    });
    return json({
      ...result,
      retrieval: result.mode,
      mode: result.mode === "vector" ? "semantic" : "keyword",
    });
  });
}
