import { getChatGPTUser } from '../../chatgpt-auth';
import { aiStatus } from '../../lib/ai';
import { SAMPLE_JOBS } from '../../lib/samples';
import { database, json, profileFromRow, publicJob, route } from '../../lib/server';
export const dynamic = 'force-dynamic';
export async function GET() { return route(async () => {
  const user = await getChatGPTUser(); const db = database();
  const currentJobs = await db.prepare("SELECT * FROM jobs WHERE status='active' AND (deadline='' OR deadline>=?) ORDER BY created_at DESC LIMIT 200").bind(new Date().toISOString().slice(0,10)).all();
  if (!user) return json({ user: null, profile: null, jobs: [...currentJobs.results.map(publicJob), ...SAMPLE_JOBS], myJobs: [], applications: [], employerApplications: [], ai: aiStatus() });
  const [p, ownJobs, sent, received] = await Promise.all([
    db.prepare('SELECT * FROM profiles WHERE user_id=?').bind(user.userId).first(),
    db.prepare('SELECT * FROM jobs WHERE owner_id=? ORDER BY created_at DESC LIMIT 100').bind(user.userId).all(),
    db.prepare('SELECT a.* FROM applications a WHERE a.candidate_id=? ORDER BY a.created_at DESC LIMIT 100').bind(user.userId).all(),
    db.prepare('SELECT a.* FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.owner_id=? ORDER BY a.created_at DESC LIMIT 100').bind(user.userId).all(),
  ]);
  const appRecord = async (a: Record<string, unknown>) => {
    const j = await db.prepare('SELECT * FROM jobs WHERE id=?').bind(a.job_id).first();
    return { id: a.id, jobId: a.job_id, status: a.status, createdAt: a.created_at, jobVersion: a.job_version, snapshot: JSON.parse(String(a.snapshot)), job: j ? publicJob(j) : null };
  };
  return json({ user: { name: user.displayName }, profile: p ? profileFromRow(p) : null,
    jobs: [...currentJobs.results.map(publicJob), ...SAMPLE_JOBS], myJobs: ownJobs.results.map(publicJob),
    applications: await Promise.all(sent.results.map(appRecord)), employerApplications: await Promise.all(received.results.map(appRecord)), ai: aiStatus() });
}); }
