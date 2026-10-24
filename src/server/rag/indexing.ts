import { createHash } from "node:crypto";
import type { Job } from "@/domain/types";
import { isCurrent } from "@/domain/matching";
import { aiStatus, embed, secrets } from "@/server/ai";
import { createAiAdminClient } from "@/server/ai-store";
import { claimWork } from "./budget";
import { jobDocument, validEmbedding } from "./documents";

export type IndexResult = {
  indexed: boolean;
  status: "indexed" | "not-configured" | "deferred" | "failed" | "stale";
};

/** Only trusted server callers may supply a vacancy loaded from the database. */
export async function indexJob(job: Job): Promise<IndexResult> {
  const client = createAiAdminClient();
  if (!client || !aiStatus().embeddings)
    return { indexed: false, status: "not-configured" };
  if (job.sample || !isCurrent(job)) return { indexed: false, status: "stale" };
  const model = secrets().GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  const text = jobDocument(job);
  const hash = createHash("sha256").update(text).digest("hex");
  let lease: Awaited<ReturnType<typeof claimWork>> = null;
  try {
    const existing = await client
      .from("job_embeddings")
      .select("job_id")
      .eq("job_id", job.id)
      .eq("job_version", job.version)
      .eq("model", model)
      .eq("content_hash", hash)
      .maybeSingle();
    if (existing.error) return { indexed: false, status: "not-configured" };
    if (existing.data) return { indexed: true, status: "indexed" };
    lease = await claimWork(
      `index:${job.id}:${job.version}:${model}:${hash}`,
      "job_embeddings",
      1000,
    );
    if (!lease) return { indexed: false, status: "deferred" };
    const vector = await embed(text);
    if (!validEmbedding(vector))
      throw new Error("Invalid embedding dimensions");
    const { data, error } = await client.rpc("store_job_embedding", {
      p_job_id: job.id,
      p_version: job.version,
      p_model: model,
      p_content_hash: hash,
      p_embedding: vector,
    });
    if (error) throw new Error("Embedding write failed");
    await lease.finish(true);
    return data === true
      ? { indexed: true, status: "indexed" }
      : { indexed: false, status: "stale" };
  } catch {
    await lease?.finish(false);
    return { indexed: false, status: "failed" };
  }
}
