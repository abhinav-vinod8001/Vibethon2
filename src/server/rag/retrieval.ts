import { z } from "zod";
import { createHash } from "node:crypto";
import type { Job } from "@/domain/types";
import { filterJobs, isCurrent, keywordScore } from "@/domain/matching";
import { SAMPLE_JOBS } from "@/domain/samples";
import { aiStatus, embed, secrets } from "@/server/ai";
import { aiStoreConfigured } from "@/server/ai-store";
import { database, publicJob } from "@/server/http";
import { createSupabaseClient } from "@/server/supabase/server";
import { claimWork } from "./budget";
import { validEmbedding } from "./documents";

export type RetrievalInput = {
  query: string;
  userId: string;
  location?: string;
  category?: string;
  type?: string;
  includeSamples?: boolean;
  limit?: number;
};
export type RetrievalResult = {
  jobs: Job[];
  mode: "vector" | "keyword";
  notice: string;
};
const hitsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    similarity: z.number().finite(),
    job_version: z.number().int().positive(),
  }),
);

function minimumSimilarity() {
  const configured = Number(process.env.RAG_MIN_SIMILARITY ?? "0.25");
  return Number.isFinite(configured) && configured >= 0 && configured <= 1
    ? configured
    : 0.25;
}

/** User JWT/RLS reads only. Never embed the vacancy collection during a search. */
export async function retrieveJobs(
  input: RetrievalInput,
): Promise<RetrievalResult> {
  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const db = await database();
  let unavailable =
    "Keyword search is active. Persistent semantic search is not configured.";
  if (input.query.trim() && aiStatus().embeddings && aiStoreConfigured()) {
    const minute = Math.floor(Date.now() / 60000);
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          query: input.query,
          location: input.location || "",
          category: input.category || "",
          type: input.type || "",
          model: secrets().GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
        }),
      )
      .digest("hex")
      .slice(0, 24);
    const lease = await claimWork(
      `search:${input.userId}:${minute}:${requestHash}`,
      `rag:${input.userId}`,
      30,
    );
    if (lease) {
      try {
        const vector = await embed(input.query, true);
        if (!validEmbedding(vector)) throw new Error("Invalid search vector");
        const client = await createSupabaseClient();
        const { data, error } = await client.rpc("match_job_embeddings", {
          p_embedding: vector,
          p_model: secrets().GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
          p_location: input.location || "",
          p_category: input.category || "",
          p_type: input.type || "",
          p_limit: limit,
          p_min_similarity: minimumSimilarity(),
        });
        if (error) throw new Error("Vector retrieval is unavailable");
        const hits = hitsSchema.parse(data);
        const rows = await Promise.all(hits.map((hit) => db.job(hit.id)));
        const jobs = filterJobs(
          rows.flatMap((row, index) =>
            row && row.version === hits[index].job_version
              ? [publicJob(row) as Job]
              : [],
          ),
          { ...input, includeSamples: false },
        );
        await lease.finish(true);
        // Empty vector results can also mean backfill has not run. Keep the explicit baseline useful.
        if (jobs.length)
          return {
            jobs,
            mode: "vector",
            notice:
              "Retrieved from the persistent vacancy index. Relevance is not an eligibility or hiring prediction.",
          };
        unavailable =
          "No indexed matches were found; showing keyword results. Existing vacancies may still need indexing.";
      } catch {
        await lease.finish(false);
        unavailable =
          "Persistent semantic search is unavailable; showing keyword results.";
      }
    } else {
      unavailable =
        "Semantic search is busy or its request limit was reached; showing keyword results.";
    }
  }
  const rows = await db.jobs();
  const real = rows
    .map((row) => publicJob(row) as Job)
    .filter((job) => isCurrent(job));
  const samples = input.includeSamples ? SAMPLE_JOBS : [];
  const ranked = filterJobs([...real, ...samples], input)
    .map((job) => ({ job, score: keywordScore(input.query, job) }))
    .filter(({ score }) => !input.query.trim() || score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return {
    jobs: ranked.map(({ job }) => job),
    mode: "keyword",
    notice: unavailable,
  };
}
