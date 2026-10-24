import type { Job } from "../../domain/types.ts";

/** A stable, public-vacancy document shared by indexing and the backfill tool. */
export function jobDocument(job: Job): string {
  return [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}`,
    `Category: ${job.category}`,
    `Type: ${job.type}`,
    `Responsibilities: ${job.description}`,
    `Requirements: ${job.requirements}`,
    `Shift: ${job.shift}`,
    `Monthly salary INR: ${job.salaryMin ?? "Not specified"} to ${job.salaryMax ?? "Not specified"}`,
    `Application deadline: ${job.deadline || "Not specified"}`,
  ].join("\n");
}

export function validEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 768 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part)) &&
    value.some((part) => part !== 0)
  );
}
