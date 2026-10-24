import { z } from 'zod';
import { aiStatus, embed, secrets } from '../../lib/ai';
import { jobText } from '../../lib/matching';
import { jobSchema } from '../../lib/validation';
import { body, checkOrigin, database, HttpError, identity, json, publicJob, route } from '../../lib/server';
import type { Job } from '../../lib/types';
export async function POST(request: Request) { return route(async () => {
  checkOrigin(request); const user = await identity(); const p = jobSchema.parse(await body(request));
  if (p.deadline && (Number.isNaN(Date.parse(p.deadline)) || new Date(p.deadline).toISOString().slice(0,10) !== p.deadline || p.deadline < new Date().toISOString().slice(0,10))) throw new HttpError(400, 'Choose a valid application deadline today or later.');
  const id = crypto.randomUUID(), now = new Date().toISOString(); let vector: number[] | null = null;
  if (aiStatus().embeddings) { try { vector = await embed(jobText(p as Job)); } catch { /* A provider outage must not prevent vacancy publication. */ } }
  await database().prepare(`INSERT INTO jobs (id,owner_id,title,company,location,category,type,salary_min,salary_max,description,requirements,shift,deadline,status,version,embedding,embedding_model,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'active',1,?,?,?,?)`)
    .bind(id,user.userId,p.title,p.company,p.location,p.category,p.type,p.salaryMin,p.salaryMax,p.description,p.requirements,p.shift,p.deadline,
      vector ? JSON.stringify(vector) : null,vector ? (secrets().GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001') : null,now,now).run();
  const row = await database().prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
  return json({ job: publicJob(row!), indexed: Boolean(vector) },201);
}); }
export async function PATCH(request: Request) { return route(async () => {
  checkOrigin(request); const user = await identity(); const input = z.object({ id:z.string().uuid(), status:z.enum(['active','closed']) }).parse(await body(request));
  const result = await database().prepare('UPDATE jobs SET status=?,version=version+1,updated_at=? WHERE id=? AND owner_id=?')
    .bind(input.status,new Date().toISOString(),input.id,user.userId).run();
  if (!result.meta.changes) throw new HttpError(404, 'Vacancy not found in your workspace.');
  return json({ ok:true });
}); }
