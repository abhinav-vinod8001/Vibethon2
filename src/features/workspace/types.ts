import type { Application, Job, Profile } from "@/domain/types";

export type Bootstrap = {
  user: { name: string } | null;
  profile: Profile | null;
  jobs: Job[];
  myJobs: Job[];
  applications: Application[];
  employerApplications: Application[];
  ai: { generation: boolean; speech: boolean; embeddings: boolean };
};
export type Explanation = {
  points: { text: string; source: string; quote: string }[];
  unknowns: string[];
  jobVersion: number;
};
export type Suggestion = {
  skills: { text: string; quote: string }[];
  questions: string[];
};
export type JobDraft = {
  title: string;
  company: string;
  location: string;
  category: string;
  type: string;
  salaryMin: string;
  salaryMax: string;
  description: string;
  requirements: string;
  shift: string;
  deadline: string;
};
