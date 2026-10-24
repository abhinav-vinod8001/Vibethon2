import { z } from "zod";
import type { Job } from "../../domain/types.ts";

export const SOURCE_FIELDS = [
  "title",
  "company",
  "location",
  "category",
  "type",
  "description",
  "requirements",
  "shift",
  "salary",
  "deadline",
] as const;
export type SourceField = (typeof SOURCE_FIELDS)[number];
const nonempty = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((text) => text.trim().length > 0);
const answerSchema = z
  .object({
    points: z
      .array(
        z
          .object({
            text: nonempty(600),
            citations: z
              .array(
                z
                  .object({
                    jobId: z.string().uuid(),
                    jobVersion: z.number().int().positive(),
                    field: z.enum(SOURCE_FIELDS),
                    quote: nonempty(800),
                  })
                  .strict(),
              )
              .min(1)
              .max(3),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    unknowns: z.array(nonempty(300)).max(4),
  })
  .strict();
export type GroundedAnswer = z.infer<typeof answerSchema>;

export function jobSources(job: Job): Record<SourceField, string> {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    category: job.category,
    type: job.type,
    description: job.description,
    requirements: job.requirements,
    shift: job.shift,
    salary:
      job.salaryMin === null && job.salaryMax === null
        ? "Not specified"
        : `${job.salaryMin ?? "Not specified"} to ${job.salaryMax ?? "Not specified"} INR per month`,
    deadline: job.deadline || "Not specified",
  };
}

/** Verifies provenance only: a valid quote is not proof of an AI claim or employer statement. */
export function validateGroundedAnswer(
  value: unknown,
  jobs: Job[],
): GroundedAnswer {
  const result = answerSchema.parse(value);
  const allowed = new Map(
    jobs.filter((job) => !job.sample).map((job) => [job.id, job]),
  );
  for (const point of result.points) {
    for (const citation of point.citations) {
      const job = allowed.get(citation.jobId);
      if (
        !job ||
        job.version !== citation.jobVersion ||
        !jobSources(job)[citation.field].includes(citation.quote)
      )
        throw new Error("A retrieved source reference could not be validated");
    }
  }
  return result;
}

export function sourceOnlyAnswer(jobs: Job[]): GroundedAnswer {
  return {
    points: jobs.slice(0, 5).map((job) => ({
      text: `${job.title} — ${job.location}`,
      citations: [
        {
          jobId: job.id,
          jobVersion: job.version,
          field: "title",
          quote: job.title,
        },
        {
          jobId: job.id,
          jobVersion: job.version,
          field: "location",
          quote: job.location,
        },
      ],
    })),
    unknowns: [],
  };
}

export const GROUNDED_ANSWER_SCHEMA = {
  type: "object",
  properties: {
    points: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          citations: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                jobId: { type: "string" },
                jobVersion: { type: "integer" },
                field: { type: "string", enum: [...SOURCE_FIELDS] },
                quote: { type: "string" },
              },
              required: ["jobId", "jobVersion", "field", "quote"],
            },
          },
        },
        required: ["text", "citations"],
      },
    },
    unknowns: { type: "array", maxItems: 4, items: { type: "string" } },
  },
  required: ["points", "unknowns"],
};
