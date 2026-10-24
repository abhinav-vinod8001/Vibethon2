import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { jobDocument, validEmbedding } from "../src/server/rag/documents.ts";

// Explicit operator action only. This tool is never invoked during a build or deployment.
for (const file of [".env.local", ".env"])
  if (existsSync(file)) process.loadEnvFile(file);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const gemini = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
if (!url || !key?.startsWith("sb_secret_") || !gemini) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL, a fresh SUPABASE_SECRET_KEY, and GEMINI_API_KEY before indexing. Do not reuse a key exposed in chat.",
  );
  process.exitCode = 1;
} else {
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });
  let cursor = "";
  const totals = { indexed: 0, existing: 0, deferred: 0, stale: 0, failed: 0 };
  const today = new Date().toISOString().slice(0, 10);
  try {
    while (true) {
      // Read only the public vacancy columns; never profiles, identities or applications.
      let query = client
        .from("jobs")
        .select(
          "id,title,company,location,category,type,salary_min,salary_max,description,requirements,shift,deadline,status,version,created_at,updated_at",
        )
        .eq("status", "active")
        .or(`deadline.is.null,deadline.gte.${today}`)
        .order("id", { ascending: true })
        .limit(50);
      if (cursor) query = query.gt("id", cursor);
      const { data: rows, error } = await query;
      if (error)
        throw new Error("Vacancy query failed; check the Supabase setup.");
      if (!rows?.length) break;
      for (const row of rows) {
        const job = {
          ...row,
          salaryMin: row.salary_min,
          salaryMax: row.salary_max,
          deadline: row.deadline || "",
        };
        const text = jobDocument(job);
        const hash = createHash("sha256").update(text).digest("hex");
        const workKey = `index:${row.id}:${row.version}:${model}:${hash}`;
        const existing = await client
          .from("job_embeddings")
          .select("job_id")
          .eq("job_id", row.id)
          .eq("job_version", row.version)
          .eq("model", model)
          .eq("content_hash", hash)
          .maybeSingle();
        if (existing.error)
          throw new Error("Apply migration 002 before indexing.");
        if (existing.data) {
          totals.existing++;
          continue;
        }
        const claim = await client.rpc("claim_ai_work", {
          p_key: workKey,
          p_bucket: "job_embeddings",
          p_daily_limit: 1000,
          p_lease_seconds: 120,
        });
        if (claim.error) throw new Error("Index lease could not be acquired.");
        if (claim.data !== true) {
          totals.deferred++;
          continue;
        }
        try {
          const isV2 = model.includes("embedding-2");
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-goog-api-key": gemini,
              },
              signal: AbortSignal.timeout(15000),
              body: JSON.stringify({
                model: `models/${model}`,
                content: {
                  parts: [
                    { text: isV2 ? `title: vacancy | text: ${text}` : text },
                  ],
                },
                outputDimensionality: 768,
                ...(isV2 ? {} : { taskType: "RETRIEVAL_DOCUMENT" }),
              }),
            },
          );
          if (!response.ok)
            throw new Error("Embedding provider request failed.");
          const payload = await response.json();
          const vector = payload.embedding?.values;
          if (!validEmbedding(vector))
            throw new Error("Invalid embedding response.");
          const stored = await client.rpc("store_job_embedding", {
            p_job_id: row.id,
            p_version: row.version,
            p_model: model,
            p_content_hash: hash,
            p_embedding: vector,
          });
          if (stored.error) throw new Error("Index write failed.");
          await client.rpc("finish_ai_work", {
            p_key: workKey,
            p_success: true,
          });
          totals[stored.data === true ? "indexed" : "stale"]++;
        } catch {
          totals.failed++;
          await client.rpc("finish_ai_work", {
            p_key: workKey,
            p_success: false,
          });
          // Stop on provider/setup failures rather than repeatedly billing unsuccessful requests.
          throw new Error(
            "Indexing stopped after a provider or storage failure; check keys, quota and migration 002.",
          );
        }
      }
      cursor = rows.at(-1).id;
      if (rows.length < 50) break;
    }
    console.log("Vacancy indexing complete:", totals);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Indexing failed.");
    console.log("Progress:", totals);
    process.exitCode = 1;
  }
}
