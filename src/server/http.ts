import { currentUser } from "./auth";
import { getDatabase } from "./database";
import { HttpError } from "./errors";
import { appOrigin } from "./supabase/config";
export { HttpError } from "./errors";
export async function identity() {
  const user = await currentUser();
  if (!user)
    throw new HttpError(
      401,
      "Sign in to save your profile or use your workspace.",
    );
  return user;
}
export function database() {
  return getDatabase();
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function route(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof Error && error.name === "ZodError")
      return json(
        { error: "Please check the required fields and their lengths." },
        400,
      );
    if (error instanceof SyntaxError)
      return json({ error: "Invalid request body." }, 400);
    console.error(
      "Request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      {
        error:
          "Something went wrong. Your edits are still on this page; please try again.",
      },
      500,
    );
  }
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 30000)
    throw new HttpError(
      413,
      "This request is too large. Please shorten your text.",
    );
  return JSON.parse(raw);
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== appOrigin())
    throw new HttpError(403, "Cross-site writes are not allowed.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Cross-site writes are not allowed.");
}
export function publicJob(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    category: row.category,
    type: row.type,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    description: row.description,
    requirements: row.requirements,
    shift: row.shift,
    deadline: row.deadline ?? "",
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function profileFromRow(row: Record<string, unknown>) {
  return {
    name: row.name,
    location: row.location,
    targetRole: row.target_role,
    language: row.language,
    experience: row.experience,
    skills: row.skills,
    availability: row.availability,
  };
}
