import { z } from "zod";
import { aiStatus, embed, secrets } from "@/server/ai";
import {
  cosine,
  filterJobs,
  jobText,
  keywordScore,
  profileText,
} from "@/domain/matching";
import { SAMPLE_JOBS } from "@/domain/samples";
import {
  body,
  checkOrigin,
  database,
  identity,
  json,
  profileFromRow,
  publicJob,
  route,
} from "@/server/http";
import type { Job, Profile } from "@/domain/types";
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
    const db = database();
    const rows = await db
      .prepare(
        "SELECT * FROM jobs WHERE status='active' AND (deadline='' OR deadline>=?) ORDER BY created_at DESC LIMIT 200",
      )
      .bind(new Date().toISOString().slice(0, 10))
      .all();
    const jobs = filterJobs(
      [...rows.results.map((r) => publicJob(r) as Job), ...SAMPLE_JOBS],
      input,
    );
    const p = await db
      .prepare("SELECT * FROM profiles WHERE user_id=?")
      .bind(user.userId)
      .first();
    const query =
      input.query || (p ? profileText(profileFromRow(p) as Profile) : "");
    let mode = "keyword";
    let notice =
      "Keyword search is active. Connect Gemini to enable semantic retrieval.";
    let ranked = jobs.map((job) => ({ job, score: keywordScore(query, job) }));
    if (query && aiStatus().embeddings && jobs.length) {
      try {
        const model =
          secrets().GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
        const q = await embed(query, true);
        // Exact vector search is intentional for this small prototype. No ANN scaling claims.
        const vectors = await Promise.all(
          jobs.map(async (job) => {
            const row = rows.results.find((r) => r.id === job.id);
            let vector: number[];
            if (row?.embedding && row.embedding_model === model) {
              vector = JSON.parse(String(row.embedding));
            } else {
              vector = await embed(jobText(job));
              if (row)
                await db
                  .prepare(
                    "UPDATE jobs SET embedding=?,embedding_model=? WHERE id=? AND version=?",
                  )
                  .bind(JSON.stringify(vector), model, job.id, job.version)
                  .run();
            }
            return { job, score: cosine(q, vector) };
          }),
        );
        ranked = vectors;
        mode = "semantic";
        notice =
          "Semantic relevance order. This is not an eligibility or hiring prediction.";
      } catch {
        notice =
          "Semantic retrieval is unavailable; showing keyword results. No AI ranking is being claimed.";
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    if (query && mode === "keyword") ranked = ranked.filter((r) => r.score > 0);
    return json({ jobs: ranked.map((r) => r.job), mode, notice });
  });
}
