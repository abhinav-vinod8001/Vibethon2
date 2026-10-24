import { createSupabaseClient } from "./supabase/server";
import { HttpError } from "./errors";
import type { Profile } from "@/domain/types";
import type { z } from "zod";
import type { jobSchema } from "@/domain/validation";
import type { ApplicationRow, JobRow, ProfileRow } from "./supabase/types";

type Result<T> = { data: T; error: { code?: string; message: string } | null };
function unwrap<T>({ data, error }: Result<T>): T {
  if (!error) return data;
  if (error.code === "42501")
    throw new HttpError(403, "You cannot access or change this record.");
  if (error.code === "P0002")
    throw new HttpError(404, "Record not found in your workspace.");
  if (error.code === "23505" || error.code === "40001")
    throw new HttpError(
      409,
      "Already applied, or this vacancy changed, closed, or expired. Refresh before trying again.",
    );
  if (error.code === "22023")
    throw new HttpError(
      error.message.includes("withdrawn") ? 409 : 400,
      error.message,
    );
  if (error.code?.startsWith("22") || error.code?.startsWith("23"))
    throw new HttpError(400, "Please check the supplied fields and try again.");
  console.error("Supabase request failed", error.code || "unavailable");
  throw new HttpError(
    503,
    "The database is unavailable. Check the Supabase setup and retry.",
  );
}
/** All reads carry the incoming user's JWT; all writes call checked SQL RPCs. */
export async function getDatabase() {
  const client = await createSupabaseClient();
  return {
    async ready() {
      unwrap(await client.from("jobs").select("id").limit(1));
    },
    async profile(userId: string) {
      return unwrap(
        await client
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
      );
    },
    async jobs() {
      const today = new Date().toISOString().slice(0, 10);
      return (
        unwrap(
          await client
            .from("jobs")
            .select("*")
            .eq("status", "active")
            .or(`deadline.is.null,deadline.gte.${today}`)
            .order("created_at", { ascending: false })
            .limit(200),
        ) ?? []
      );
    },
    async ownJobs(userId: string) {
      return (
        unwrap(
          await client
            .from("jobs")
            .select("*")
            .eq("owner_id", userId)
            .order("created_at", { ascending: false })
            .limit(100),
        ) ?? []
      );
    },
    async job(id: string) {
      return unwrap(
        await client.from("jobs").select("*").eq("id", id).maybeSingle(),
      );
    },
    async application(id: string, jobId: string) {
      return unwrap(
        await client
          .from("applications")
          .select("*")
          .eq("id", id)
          .eq("job_id", jobId)
          .maybeSingle(),
      );
    },
    async sentApplications(userId: string) {
      return (
        unwrap(
          await client
            .from("applications")
            .select("*")
            .eq("candidate_id", userId)
            .order("created_at", { ascending: false })
            .limit(100),
        ) ?? []
      );
    },
    async receivedApplications(userId: string) {
      return (
        unwrap(
          await client
            .from("applications")
            .select("*, jobs!inner(owner_id)")
            .eq("jobs.owner_id", userId)
            .order("created_at", { ascending: false })
            .limit(100),
        ) ?? []
      );
    },
    async saveProfile(profile: Profile) {
      return unwrap(
        await client.rpc("save_profile", {
          p_profile: { ...profile },
          p_confirmed: true,
        }),
      ) as ProfileRow;
    },
    async createJob(job: z.infer<typeof jobSchema>) {
      return unwrap(
        await client.rpc("create_job", { p_job: { ...job } }),
      ) as JobRow;
    },
    async setJobStatus(id: string, status: string) {
      return unwrap(
        await client.rpc("set_job_status", { p_job_id: id, p_status: status }),
      ) as JobRow;
    },
    async submitApplication(jobId: string, version: number) {
      return unwrap(
        await client.rpc("submit_application", {
          p_job_id: jobId,
          p_version: version,
          p_confirmed: true,
        }),
      ) as ApplicationRow;
    },
    async setApplicationStatus(id: string, status: string) {
      return unwrap(
        await client.rpc("set_application_status", {
          p_application_id: id,
          p_status: status,
        }),
      ) as ApplicationRow;
    },
  };
}
