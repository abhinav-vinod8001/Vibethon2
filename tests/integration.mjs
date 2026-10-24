import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { startSupabaseFixture } from "./helpers/supabase.mjs";
import assert from "node:assert/strict";

const directory = await mkdtemp(join(tmpdir(), "jobsathi-integration-"));
const socket = createServer();
socket.listen(0, "127.0.0.1");
await once(socket, "listening");
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const supabase = await startSupabaseFixture();
const environment = {
  ...process.env,
  NODE_ENV: "production",
  APP_URL: base,
  NEXT_PUBLIC_SUPABASE_URL: supabase.url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.key,
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "",
  SARVAM_API_KEY: "",
  PORT: String(port),
  HOSTNAME: "127.0.0.1",
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
  return supabase.cookie(user);
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
  server = spawn(
    process.execPath,
    process.argv.includes("--standalone")
      ? [".next/standalone/server.js"]
      : [
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
      const health = await fetch(base + "/api/health");
      if (health.ok) {
        ready = true;
        break;
      }
      if (attempt === 119)
        output += `\nHealth: ${health.status} ${await health.text()}`;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, output);
  assert.equal((await fetch(base)).status, 200);
  checks++;
  const { employer, candidate, stranger } = supabase.users;
  const login = await fetch(base + "/api/auth/sign-in", {
    method: "POST",
    headers: { origin: base },
  });
  assert.equal(login.status, 200);
  checks++;
  const oauth = new URL((await login.json()).url);
  assert.equal(oauth.origin, supabase.url);
  checks++;
  assert.equal(oauth.searchParams.get("provider"), "google");
  checks++;
  assert.equal(oauth.searchParams.get("redirect_to"), base + "/auth/callback");
  checks++;
  assert.equal(oauth.searchParams.get("code_challenge_method"), "s256");
  checks++;
  const pkceCookies = login.headers.getSetCookie();
  assert.ok(
    pkceCookies.some(
      (value) => value.includes("code-verifier=") && value.includes("HttpOnly"),
    ),
  );
  checks++;
  const code = supabase.issueCode(
    employer,
    oauth.searchParams.get("code_challenge"),
  );
  const callback = await fetch(
    base + "/auth/callback?code=" + code + "&next=https://other.test",
    {
      redirect: "manual",
      headers: {
        cookie: pkceCookies.map((value) => value.split(";")[0]).join("; "),
      },
    },
  );
  assert.equal(callback.status, 307);
  checks++;
  assert.equal(callback.headers.get("location"), base + "/");
  checks++;
  assert.ok(
    callback.headers
      .getSetCookie()
      .some((value) => value.startsWith(supabase.cookieName + "=")),
  );
  checks++;
  const browserCookie = callback.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const browserState = await fetch(base + "/api/bootstrap", {
    headers: { cookie: browserCookie },
  });
  assert.equal((await browserState.json()).user.name, "Synthetic Test User");
  checks++;
  const failedCallback = await fetch(base + "/auth/callback?code=bad-code", {
    redirect: "manual",
  });
  assert.equal(failedCallback.headers.get("location"), base + "/?auth_error=1");
  checks++;
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
  await request("/api/profile/resume", "GET", undefined, undefined, 401);
  await request("/api/profile/resume", "GET", undefined, employer, 404);
  async function exportResume(user, filename) {
    // A caller-supplied ID must never change whose profile is exported.
    const response = await fetch(
      base + "/api/profile/resume?userId=" + encodeURIComponent(candidate),
      { headers: { cookie: await cookie(user) } },
    );
    assert.equal(response.status, 200);
    checks++;
    assert.equal(response.headers.get("content-type"), "application/pdf");
    checks++;
    assert.equal(
      response.headers.get("content-disposition"),
      'attachment; filename="jobsathi-resume.pdf"',
    );
    checks++;
    assert.ok(response.headers.get("cache-control").includes("no-store"));
    checks++;
    assert.ok(
      response.headers
        .get("vary")
        .toLowerCase()
        .split(/,\s*/)
        .includes("cookie"),
    );
    checks++;
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    checks++;
    assert.ok(bytes.length > 1000);
    checks++;
    if (process.env.JOBSATHI_PDF_QA_DIR) {
      await mkdir(process.env.JOBSATHI_PDF_QA_DIR, { recursive: true });
      await writeFile(join(process.env.JOBSATHI_PDF_QA_DIR, filename), bytes);
    }
  }
  await exportResume(candidate, "english-resume.pdf");
  const malayalamProfile = {
    ...profile,
    name: "അനു നായർ",
    targetRole: "Retail Assistant",
    location: "കൊച്ചി",
    experience:
      "കുടുംബത്തിന്റെ കടയിൽ സാധനങ്ങൾ ക്രമീകരിക്കുകയും ഉപഭോക്താക്കളെ സഹായിക്കുകയും ചെയ്തു. പണമിടപാടുകൾ കൈകാര്യം ചെയ്തു.",
    skills: "",
    availability: "പകൽ സമയത്ത് ജോലി ചെയ്യാം.",
  };
  await request(
    "/api/profile",
    "PUT",
    { profile: malayalamProfile, confirmed: true },
    employer,
  );
  await exportResume(employer, "malayalam-resume.pdf");
  const longProfile = {
    ...profile,
    name: "Long Profile Candidate",
    experience:
      "I organised stock, assisted customers, checked orders, and collected payments.\n".repeat(
        65,
      ) + "FINAL EXPERIENCE LINE",
    skills: "Organising stock and assisting customers. ".repeat(35),
  };
  await request(
    "/api/profile",
    "PUT",
    { profile: longProfile, confirmed: true },
    employer,
  );
  await exportResume(employer, "long-resume.pdf");
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
      cookie: supabase.cookieName + "=invalid",
    },
    body: JSON.stringify({ profile, confirmed: true }),
  });
  assert.equal(tampered.status, 401);
  checks++;
  const expiredResponse = await fetch(base + "/api/profile", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie: supabase.cookie(employer, -3600),
    },
    body: JSON.stringify({ profile, confirmed: true }),
  });
  assert.equal(expiredResponse.status, 401);
  checks++;
  const session = await request("/api/bootstrap", "GET", undefined, employer);
  assert.equal(session.user.name, "Synthetic Test User");
  checks++;
  const spoofed = supabase.session(employer);
  spoofed.user.id = candidate;
  spoofed.user.user_metadata.full_name = "Forged Cookie Name";
  const spoofedCookie = `${supabase.cookieName}=base64-${Buffer.from(JSON.stringify(spoofed)).toString("base64url")}`;
  const verified = await fetch(base + "/api/bootstrap", {
    headers: { cookie: spoofedCookie },
  });
  const verifiedState = await verified.json();
  assert.equal(verifiedState.user.name, "Synthetic Test User");
  checks++;
  assert.equal(verifiedState.profile.name, longProfile.name);
  checks++;
  const refresh = await fetch(base + "/api/bootstrap", {
    headers: { cookie: supabase.cookie(employer, 30) },
  });
  assert.equal(refresh.status, 200);
  checks++;
  assert.equal((await refresh.json()).user.name, "Synthetic Test User");
  checks++;
  const refreshedCookies = refresh.headers.getSetCookie();
  assert.ok(
    refreshedCookies.some(
      (value) =>
        value.startsWith(supabase.cookieName + "=") &&
        value.includes("HttpOnly"),
    ),
  );
  checks++;
  assert.ok(refresh.headers.get("cache-control").includes("no-store"));
  checks++;
  const refreshed = await fetch(base + "/api/bootstrap", {
    headers: {
      cookie: refreshedCookies.map((value) => value.split(";")[0]).join("; "),
    },
  });
  assert.equal((await refreshed.json()).user.name, "Synthetic Test User");
  checks++;
  for (const path of ["/api/auth/sign-in", "/api/auth/sign-out"]) {
    const crossSite = await fetch(base + path, {
      method: "POST",
      headers: { origin: "https://other.test", cookie: await cookie(employer) },
    });
    assert.equal(crossSite.status, 403);
    checks++;
  }
  supabase.databaseOutage(true);
  await request("/api/health", "GET", undefined, undefined, 503);
  await request("/api/bootstrap", "GET", undefined, undefined, 503);
  supabase.databaseOutage(false);
  await request("/api/health");
  const logout = await fetch(base + "/api/auth/sign-out", {
    method: "POST",
    headers: {
      origin: base,
      cookie: await cookie(employer),
    },
  });
  assert.equal(logout.status, 200);
  checks++;
  assert.ok(
    logout.headers
      .getSetCookie()
      .some(
        (value) =>
          value.startsWith(supabase.cookieName + "=") &&
          value.includes("Max-Age=0"),
      ),
  );
  checks++;
  server.kill();
  await once(server, "exit");
  // A separate process proves empty config works independently of the fixture.
  server = spawn(
    process.execPath,
    process.argv.includes("--standalone")
      ? [".next/standalone/server.js"]
      : [
          "node_modules/next/dist/bin/next",
          "start",
          "-H",
          "127.0.0.1",
          "-p",
          String(port),
        ],
    {
      ...options,
      env: {
        ...environment,
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      },
    },
  );
  server.stdout.on("data", (data) => {
    output += data;
  });
  server.stderr.on("data", (data) => {
    output += data;
  });
  let demo;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      const response = await fetch(base + "/api/bootstrap");
      if (response.ok) {
        demo = await response.json();
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(demo, output);
  checks++;
  assert.equal(demo.auth.configured, false);
  checks++;
  assert.equal(demo.user, null);
  checks++;
  assert.ok(demo.jobs.length > 0 && demo.jobs.every((job) => job.sample));
  checks++;
  await request("/api/health", "GET", undefined, undefined, 503);
  await request("/api/auth/sign-in", "POST", undefined, undefined, 503);
  await request(
    "/api/profile",
    "PUT",
    { profile, confirmed: true },
    undefined,
    401,
  );
  console.log(
    `PASS: ${checks} integration assertions. Built Next.js routes, PostgreSQL/RLS, simulated Supabase Auth/PostgREST. No external AI/Google requests.`,
  );
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
  await rm(directory, { recursive: true, force: true });
  await supabase.close();
}
