import type { Job, Profile } from "./types";
export function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])].filter(
    (t) => t.length > 2,
  );
}
// An explicit keyword baseline, never labelled semantic AI.
export function keywordScore(query: string, job: Job): number {
  const words = tokens(query);
  const title = new Set(tokens(job.title));
  const body = new Set(
    tokens(`${job.category} ${job.description} ${job.requirements}`),
  );
  return words.reduce(
    (score, word) => score + (title.has(word) ? 3 : body.has(word) ? 1 : 0),
    0,
  );
}
export function isCurrent(
  job: Job,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  return job.status === "active" && (!job.deadline || job.deadline >= today);
}
export function filterJobs(
  jobs: Job[],
  opts: {
    location?: string;
    category?: string;
    type?: string;
    includeSamples?: boolean;
  },
) {
  return jobs.filter(
    (j) =>
      isCurrent(j) &&
      (opts.includeSamples !== false || !j.sample) &&
      (!opts.location ||
        j.location.toLowerCase().includes(opts.location.toLowerCase())) &&
      (!opts.category || j.category === opts.category) &&
      (!opts.type || j.type === opts.type),
  );
}
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export function jobText(job: Job): string {
  return `${job.title}\n${job.category}\nResponsibilities: ${job.description}\nRequirements: ${job.requirements}`;
}
export function profileText(p: Profile): string {
  return `${p.targetRole}\nExperience: ${p.experience}\nSkills reported by candidate: ${p.skills}`;
}
