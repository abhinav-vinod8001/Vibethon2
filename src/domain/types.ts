export type Profile = {
  name: string;
  location: string;
  targetRole: string;
  language: string;
  experience: string;
  skills: string;
  availability: string;
};
export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  category: string;
  type: string;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  requirements: string;
  shift: string;
  deadline: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  sample?: boolean;
};
export type Application = {
  id: string;
  jobId: string;
  status: string;
  createdAt: string;
  snapshot: Profile;
  job: Job;
  jobVersion: number;
};
export const EMPTY_PROFILE: Profile = {
  name: "",
  location: "",
  targetRole: "",
  language: "Malayalam",
  experience: "",
  skills: "",
  availability: "",
};
export const CATEGORIES = [
  "Retail",
  "Office & admin",
  "Delivery",
  "Hospitality",
  "Customer support",
  "Other",
];
