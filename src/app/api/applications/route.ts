import { z } from "zod";
import {
  body,
  checkOrigin,
  database,
  HttpError,
  identity,
  json,
  profileFromRow,
  route,
} from "@/server/http";
export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const user = await identity();
    const input = z
      .object({
        jobId: z.string().uuid(),
        version: z.number().int().positive(),
        confirmed: z.literal(true),
      })
      .parse(await body(request));
    const db = database();
    const profile = await db
      .prepare("SELECT * FROM profiles WHERE user_id=?")
      .bind(user.userId)
      .first();
    if (!profile)
      throw new HttpError(
        400,
        "Create and confirm your profile before applying.",
      );
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const result = await db
      .prepare(
        `INSERT INTO applications (id,job_id,candidate_id,snapshot,job_version,status,created_at,updated_at)
    SELECT ?,id,?,?,version,'submitted',?,? FROM jobs WHERE id=? AND status='active' AND version=? AND (deadline='' OR deadline>=?)
    ON CONFLICT(job_id,candidate_id) DO NOTHING`,
      )
      .bind(
        id,
        user.userId,
        JSON.stringify(profileFromRow(profile)),
        now,
        now,
        input.jobId,
        input.version,
        now.slice(0, 10),
      )
      .run();
    if (!result.meta.changes)
      throw new HttpError(
        409,
        "Already applied, or this vacancy changed or closed. Refresh before trying again.",
      );
    return json({ id, status: "submitted" }, 201);
  });
}
export async function PATCH(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const user = await identity();
    const input = z
      .object({
        id: z.string().uuid(),
        status: z.enum(["shortlisted", "contacted", "withdrawn"]),
      })
      .parse(await body(request));
    const db = database();
    const a = await db
      .prepare(
        "SELECT a.*,j.owner_id FROM applications a JOIN jobs j ON a.job_id=j.id WHERE a.id=?",
      )
      .bind(input.id)
      .first();
    if (!a) throw new HttpError(404, "Application not found.");
    const isWithdrawal = input.status === "withdrawn";
    if (
      isWithdrawal ? a.candidate_id !== user.userId : a.owner_id !== user.userId
    )
      throw new HttpError(403, "You cannot update this application.");
    if (a.status === "withdrawn")
      throw new HttpError(409, "This application has been withdrawn.");
    await db
      .prepare(
        "UPDATE applications SET status=?,updated_at=? WHERE id=? AND status!=?",
      )
      .bind(input.status, new Date().toISOString(), input.id, "withdrawn")
      .run();
    return json({ ok: true });
  });
}
