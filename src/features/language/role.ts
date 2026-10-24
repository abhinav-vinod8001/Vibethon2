export type EntryRole = "candidate" | "employer";
export const ROLE_COOKIE = "jobsathi_role";

export function isEntryRole(value: unknown): value is EntryRole {
  return value === "candidate" || value === "employer";
}
