import { createAiAdminClient } from "@/server/ai-store";

/** Durable leases work across independent Vercel instances; fail closed on setup errors. */
export async function claimWork(key: string, bucket: string, limit: number) {
  const client = createAiAdminClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc("claim_ai_work", {
      p_key: key,
      p_bucket: bucket,
      p_daily_limit: limit,
      p_lease_seconds: 120,
    });
    if (error || data !== true) return null;
    return {
      async finish(success: boolean) {
        try {
          await client.rpc("finish_ai_work", {
            p_key: key,
            p_success: success,
          });
        } catch {
          // The lease expires; never turn a completed user operation into an error.
        }
      },
    };
  } catch {
    return null;
  }
}
