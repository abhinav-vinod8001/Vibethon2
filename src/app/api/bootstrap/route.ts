import { currentUser } from "@/server/auth";
import { aiStatus } from "@/server/ai";
import { SAMPLE_JOBS } from "@/domain/samples";
import {
  database,
  json,
  profileFromRow,
  publicJob,
  route,
} from "@/server/http";
import { supabaseConfig } from "@/server/supabase/config";
import type { ApplicationRow } from "@/server/supabase/types";
export const dynamic = "force-dynamic";
export async function GET() {
  return route(async () => {
    const guest = {
      user: null,
      profile: null,
      jobs: SAMPLE_JOBS,
      myJobs: [],
      applications: [],
      employerApplications: [],
      ai: aiStatus(),
      auth: { configured: Boolean(supabaseConfig()) },
    };
    if (!supabaseConfig()) return json(guest);
    const user = await currentUser();
    const db = await database();
    const jobs = await db.jobs();
    if (!user)
      return json({ ...guest, jobs: [...jobs.map(publicJob), ...SAMPLE_JOBS] });
    const [profile, ownJobs, sent, received] = await Promise.all([
      db.profile(user.userId),
      db.ownJobs(user.userId),
      db.sentApplications(user.userId),
      db.receivedApplications(user.userId),
    ]);
    const jobIds = new Set([...sent, ...received].map((a) => a.job_id));
    const relatedJobs = new Map(
      await Promise.all(
        [...jobIds].map(async (id) => [id, await db.job(id)] as const),
      ),
    );
    const appRecord = (a: ApplicationRow) => ({
      id: a.id,
      jobId: a.job_id,
      status: a.status,
      createdAt: a.created_at,
      jobVersion: a.job_version,
      snapshot: a.snapshot,
      job: relatedJobs.get(a.job_id)
        ? publicJob(relatedJobs.get(a.job_id)!)
        : null,
    });
    return json({
      ...guest,
      user: { name: user.displayName },
      profile: profile ? profileFromRow(profile) : null,
      jobs: [...jobs.map(publicJob), ...SAMPLE_JOBS],
      myJobs: ownJobs.map(publicJob),
      applications: sent.map(appRecord),
      employerApplications: received.map(appRecord),
    });
  });
}
