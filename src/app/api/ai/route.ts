import { z } from "zod";
import { generate, SAFE_SYSTEM } from "@/server/ai";
import {
  body,
  checkOrigin,
  database,
  HttpError,
  identity,
  json,
  profileFromRow,
  publicJob,
  route,
} from "@/server/http";
import { SAMPLE_JOBS } from "@/domain/samples";
import { profileSchema } from "@/domain/validation";
const extractSchema = z.object({
  skills: z
    .array(
      z.object({
        text: z.string().min(1).max(120),
        quote: z.string().min(1).max(500),
      }),
    )
    .max(12),
  questions: z.array(z.string().min(1).max(300)).max(2),
});
const answerSchema = z.object({
  points: z
    .array(
      z.object({
        text: z.string().min(1).max(600),
        source: z.enum([
          "description",
          "requirements",
          "shift",
          "salary",
          "deadline",
          "experience",
          "skills",
          "availability",
        ]),
        quote: z.string().min(1).max(800),
      }),
    )
    .max(6),
  unknowns: z.array(z.string().max(300)).max(4),
});
export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const user = await identity();
    const input = await body(request);
    if (input.action === "extract") {
      const { transcript, language } = z
        .object({
          transcript: z.string().trim().min(10).max(6000),
          language: z.string().max(50),
        })
        .parse(input);
      const raw = await generate(
        `${SAFE_SYSTEM} Extract only explicitly supported skills. Each skill must include a short verbatim supporting quote from the transcript. Do not infer tool expertise from general tasks. Return skill labels in English; return up to two useful follow-up questions in the user's requested language. Do not rewrite or replace the original experience.`,
        { transcript, language },
        {
          type: "object",
          properties: {
            skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  quote: { type: "string" },
                },
                required: ["text", "quote"],
              },
            },
            questions: { type: "array", items: { type: "string" } },
          },
          required: ["skills", "questions"],
        },
      );
      const result = extractSchema.parse(raw);
      if (result.skills.some((s) => !transcript.includes(s.quote)))
        throw new HttpError(
          502,
          "An AI suggestion had no valid supporting quote. Please retry or edit manually.",
        );
      return json(result);
    }
    const { action, jobId, question, applicationId } = z
      .object({
        action: z.enum(["explain", "applicant"]),
        jobId: z.string().max(100),
        question: z.string().max(1000).optional(),
        applicationId: z.string().uuid().optional(),
      })
      .parse(input);
    const db = await database();
    const row = z.string().uuid().safeParse(jobId).success
      ? await db.job(jobId)
      : null;
    const job = row ? publicJob(row) : SAMPLE_JOBS.find((j) => j.id === jobId);
    if (!job) throw new HttpError(404, "Vacancy not found.");
    let profile;
    if (action === "applicant") {
      if (!row || row.owner_id !== user.userId || !applicationId)
        throw new HttpError(403, "This applicant is not in your workspace.");
      const a = await db.application(applicationId, jobId);
      if (!a || a.status === "withdrawn")
        throw new HttpError(404, "Application is not available.");
      profile = profileSchema.parse(a.snapshot);
    } else {
      const p = await db.profile(user.userId);
      if (!p)
        throw new HttpError(
          400,
          "Save your profile first so explanations can use confirmed experience.",
        );
      profile = profileFromRow(p);
    }
    // Retrieve exact current records, not stale vector text. Exclude identity attributes from model context.
    const sources: Record<string, string> = {
      description: String(job.description),
      requirements: String(job.requirements),
      shift: String(job.shift),
      salary:
        job.salaryMin === null && job.salaryMax === null
          ? "Not specified"
          : `${job.salaryMin ?? "Not specified"} to ${job.salaryMax ?? "Not specified"} INR per month`,
      deadline: String(job.deadline || "Not specified"),
      experience: String(profile.experience),
      skills: String(profile.skills),
      availability: String(profile.availability),
    };
    const raw = await generate(
      `${SAFE_SYSTEM} Answer using only retrieved sources. Explain relevant experience and uncertainties, not an eligibility verdict or numeric score. Each point must cite one source field and an exact quote from that field. Put missing information in unknowns. A quote supports traceability, not independent factual verification. Candidate skills are self-reported. For applicant summaries describe evidence without ranking candidates. Respond in plain English.`,
      {
        action,
        question:
          question ||
          "Explain the relevant experience and important things to clarify for this vacancy.",
        sources,
      },
      {
        type: "object",
        properties: {
          points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                source: { type: "string", enum: Object.keys(sources) },
                quote: { type: "string" },
              },
              required: ["text", "source", "quote"],
            },
          },
          unknowns: { type: "array", items: { type: "string" } },
        },
        required: ["points", "unknowns"],
      },
    );
    const result = answerSchema.parse(raw);
    if (result.points.some((p) => !sources[p.source]?.includes(p.quote)))
      throw new HttpError(
        502,
        "A source reference could not be validated. Please retry; no ungrounded answer was shown.",
      );
    return json({
      ...result,
      jobId,
      jobVersion: job.version,
      retrievedAt: new Date().toISOString(),
    });
  });
}
