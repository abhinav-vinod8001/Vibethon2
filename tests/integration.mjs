import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { encode } from "next-auth/jwt";
import assert from "node:assert/strict";

const directory = await mkdtemp(join(tmpdir(), "jobsathi-integration-"));
const socket = createServer();
socket.listen(0, "127.0.0.1");
await once(socket, "listening");
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const secret = randomBytes(48).toString("base64url");
const environment = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: pathToFileURL(join(directory, "test.db")).href,
  DATABASE_AUTH_TOKEN: "",
  NEXTAUTH_URL: base,
  NEXTAUTH_SECRET: secret,
  GOOGLE_CLIENT_ID: "synthetic-google-client",
  GOOGLE_CLIENT_SECRET: "synthetic-google-secret",
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "",
  SARVAM_API_KEY: "",
};
const options = {
  cwd: process.cwd(),
  env: environment,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
};
let server;
let output = "";
let checks = 0;
async function cookie(user) {
  return (
    "next-auth.session-token=" +
    (await encode({
      secret,
      token: { userId: user, name: "Synthetic Test User" },
      maxAge: 3600,
    }))
  );
}
async function request(
  path,
  method = "GET",
  payload = undefined,
  user = undefined,
  expected = 200,
) {
  const headers = { "content-type": "application/json" };
  if (user) headers.cookie = await cookie(user);
  const response = await fetch(base + path, {
    method,
    headers,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `${method} ${path}: non-JSON ${response.status}: ${text.slice(0, 200)}`,
    );
  }
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  checks++;
  return data;
}
try {
  const migration = spawn(process.execPath, ["scripts/migrate.mjs"], options);
  migration.stdout.on("data", (data) => {
    output += data;
  });
  migration.stderr.on("data", (data) => {
    output += data;
  });
  assert.equal((await once(migration, "exit"))[0], 0, output);
  // Running migrations twice must preserve existing schema/data.
  const repeat = spawn(process.execPath, ["scripts/migrate.mjs"], options);
  assert.equal(
    (await once(repeat, "exit"))[0],
    0,
    "Repeat migrations must be idempotent",
  );
  checks++;
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    options,
  );
  server.stdout.on("data", (data) => {
    output += data;
  });
  server.stderr.on("data", (data) => {
    output += data;
  });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, output);
  assert.equal((await fetch(base)).status, 200);
  checks++;
  const providers = await request("/api/auth/providers");
  assert.equal(providers.google.id, "google");
  checks++;
  const csrfResponse = await fetch(base + "/api/auth/csrf");
  const csrf = await csrfResponse.json();
  assert.ok(csrf.csrfToken);
  checks++;
  const csrfCookie = csrfResponse.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const employer = "google:test-employer",
    candidate = "google:test-candidate",
    stranger = "google:test-stranger";
  const profile = {
    name: "Synthetic Candidate",
    location: "Kothamangalam",
    targetRole: "Retail assistant",
    language: "Malayalam",
    experience: "I arranged products and collected payments in a family shop.",
    skills: "Arranging products",
    availability: "Day shift",
  };
  await request(
    "/api/profile",
    "PUT",
    { profile, confirmed: true },
    undefined,
    401,
  );
  await request(
    "/api/profile",
    "PUT",
    { profile, confirmed: false },
    candidate,
    400,
  );
  await request("/api/profile", "PUT", { profile, confirmed: true }, candidate);
  const draft = {
    title: "Test Retail Assistant",
    company: "Synthetic Test Company",
    location: "Kothamangalam",
    category: "Retail",
    type: "Full-time",
    salaryMin: 12000,
    salaryMax: 15000,
    description: "Arrange products and help with everyday shop operations.",
    requirements:
      "Required: Malayalam communication. Preferred: billing experience.",
    shift: "Day shift",
    deadline: "",
  };
  const job = (await request("/api/jobs", "POST", draft, employer, 201)).job;
  await request(
    "/api/jobs",
    "POST",
    { ...draft, salaryMax: 100 },
    employer,
    400,
  );
  await request(
    "/api/jobs",
    "POST",
    { ...draft, deadline: "2020-01-01" },
    employer,
    400,
  );
  await request(
    "/api/jobs",
    "PATCH",
    { id: job.id, status: "closed" },
    stranger,
    404,
  );
  const apply = { jobId: job.id, version: job.version, confirmed: true };
  const application = await request(
    "/api/applications",
    "POST",
    apply,
    candidate,
    201,
  );
  await request("/api/applications", "POST", apply, candidate, 409);
  await request(
    "/api/applications",
    "PATCH",
    { id: application.id, status: "shortlisted" },
    stranger,
    403,
  );
  const other = await request("/api/bootstrap", "GET", undefined, stranger);
  assert.deepEqual(other.employerApplications, []);
  assert.deepEqual(other.applications, []);
  checks++;
  const owner = await request("/api/bootstrap", "GET", undefined, employer);
  assert.ok(owner.employerApplications.some((a) => a.id === application.id));
  checks++;
  await request(
    "/api/ai",
    "POST",
    { action: "applicant", jobId: job.id, applicationId: application.id },
    stranger,
    403,
  );
  await request(
    "/api/applications",
    "PATCH",
    { id: application.id, status: "shortlisted" },
    employer,
  );
  await request(
    "/api/profile",
    "PUT",
    {
      profile: {
        ...profile,
        experience: "This later edit must not change the submitted snapshot.",
      },
      confirmed: true,
    },
    candidate,
  );
  const candidateState = await request(
    "/api/bootstrap",
    "GET",
    undefined,
    candidate,
  );
  assert.equal(
    candidateState.applications[0].snapshot.experience,
    profile.experience,
  );
  checks++;
  await request(
    "/api/jobs",
    "PATCH",
    { id: job.id, status: "closed" },
    employer,
  );
  const closed = await request("/api/bootstrap", "GET", undefined, candidate);
  assert.ok(!closed.jobs.some((j) => j.id === job.id));
  checks++;
  await request("/api/profile", "PUT", { profile, confirmed: true }, stranger);
  await request("/api/applications", "POST", apply, stranger, 409);
  await request(
    "/api/jobs",
    "PATCH",
    { id: job.id, status: "active" },
    employer,
  );
  await request("/api/applications", "POST", apply, stranger, 409);
  await request(
    "/api/applications",
    "PATCH",
    { id: application.id, status: "withdrawn" },
    candidate,
  );
  await request(
    "/api/applications",
    "PATCH",
    { id: application.id, status: "shortlisted" },
    employer,
    409,
  );
  const search = await request(
    "/api/match",
    "POST",
    { query: "retail", includeSamples: false },
    candidate,
  );
  assert.equal(search.mode, "keyword");
  assert.ok(search.jobs.some((j) => j.id === job.id));
  checks++;
  await request(
    "/api/ai",
    "POST",
    { action: "extract", transcript: profile.experience, language: "English" },
    candidate,
    503,
  );
  await request(
    "/api/jobs",
    "PATCH",
    { id: job.id, status: "closed" },
    employer,
  );
  const origin = await fetch(base + "/api/jobs", {
    method: "POST",
    headers: {
      origin: "https://other.test",
      "content-type": "application/json",
      cookie: await cookie(employer),
    },
    body: JSON.stringify(draft),
  });
  assert.equal(origin.status, 403);
  checks++;
  const forged = await fetch(base + "/api/profile", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": employer,
    },
    body: JSON.stringify({ profile, confirmed: true }),
  });
  assert.equal(forged.status, 401);
  checks++;
  const tampered = await fetch(base + "/api/profile", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie: "next-auth.session-token=invalid",
    },
    body: JSON.stringify({ profile, confirmed: true }),
  });
  assert.equal(tampered.status, 401);
  checks++;
  const expired = await encode({
    secret,
    token: { userId: employer },
    maxAge: -3600,
  });
  const expiredResponse = await fetch(base + "/api/profile", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie: "next-auth.session-token=" + expired,
    },
    body: JSON.stringify({ profile, confirmed: true }),
  });
  assert.equal(expiredResponse.status, 401);
  checks++;
  const session = await request(
    "/api/auth/session",
    "GET",
    undefined,
    employer,
  );
  assert.equal(session.user.name, "Synthetic Test User");
  checks++;
  const logout = await fetch(base + "/api/auth/signout", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `${csrfCookie}; ${await cookie(employer)}`,
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      callbackUrl: base,
      json: "true",
    }),
  });
  assert.equal(logout.status, 200);
  checks++;
  assert.ok(
    logout.headers
      .getSetCookie()
      .some(
        (value) =>
          value.startsWith("next-auth.session-token=") &&
          value.includes("Max-Age=0"),
      ),
  );
  checks++;
  console.log(
    `PASS: ${checks} integration assertions. Built Next.js routes, temporary SQLite/libSQL database, signed synthetic sessions. No external AI/OAuth requests.`,
  );
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
  await rm(directory, { recursive: true, force: true });
}
