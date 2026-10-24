import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { startSupabaseFixture } from "./helpers/supabase.mjs";

const directory = await mkdtemp(join(tmpdir(), "jobsathi-ai-integration-"));
const traceFile = join(directory, "provider.jsonl");
await writeFile(traceFile, "");
const supabase = await startSupabaseFixture({ ai: true });
const socket = createServer();
socket.listen(0, "127.0.0.1");
await once(socket, "listening");
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const preload = fileURLToPath(
  new URL("./helpers/gemini-preload.cjs", import.meta.url),
).replaceAll("\\", "/");
let server;
let output = "";
let checks = 0;
const assertCheck = (value, message) => {
  assert.ok(value, message);
  checks++;
};

async function request(
  path,
  { method = "GET", payload, user, expected = 200, origin = base } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      origin,
      ...(payload !== undefined ? { "content-type": "application/json" } : {}),
      ...(user ? { cookie: supabase.cookie(user) } : {}),
    },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  checks++;
  return data;
}
async function providerCalls() {
  return (await readFile(traceFile, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

try {
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
    {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "production",
        NODE_OPTIONS: `--require "${preload}"`,
        APP_URL: base,
        NEXT_PUBLIC_SUPABASE_URL: supabase.url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.key,
        SUPABASE_SECRET_KEY: supabase.secretKey,
        GEMINI_API_KEY: "gemini_jobsathi_mock",
        GEMINI_MODEL: "jobsathi-test-generation",
        GEMINI_EMBEDDING_MODEL: "gemini-embedding-001",
        SARVAM_API_KEY: "",
        JOBSATHI_MOCK_TRACE: traceFile,
      },
    },
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
    } catch {
      /* Wait briefly for the built server, never a provider. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assertCheck(ready, output);
  const { employer, candidate, stranger } = supabase.users;
  const languages = await request("/api/languages");
  assertCheck(
    languages.source === "database" && languages.languages.length === 5,
    "database language registry",
  );
  const path = "/api/translations?locale=ml&bundle=entry";
  const initial = await request(path);
  assertCheck(
    initial.source === "fallback" && initial.canGenerate,
    "free initial fallback",
  );
  assertCheck((await providerCalls()).length === 0, "GET must not call Gemini");
  const translated = await request(path, { method: "POST" });
  assertCheck(
    translated.source === "cache" &&
      translated.messages["Continue with Google"] === "ML Continue with Google",
    "API bundle persisted",
  );
  const translationCalls = (await providerCalls()).length;
  const cached = await request(path);
  await request(path, { method: "POST" });
  assertCheck(
    cached.source === "cache" &&
      (await providerCalls()).length === translationCalls,
    "cached reads/repeated POST do not regenerate",
  );
  await request("/api/translations?locale=xx&bundle=entry", { expected: 400 });
  await request("/api/translations?locale=ml&bundle=arbitrary", {
    expected: 400,
  });
  await request(path, {
    method: "POST",
    origin: "https://other.test",
    expected: 403,
  });
  await request("/api/rag", {
    method: "POST",
    payload: { question: "Find work" },
    expected: 401,
  });

  const created = await request("/api/jobs", {
    method: "POST",
    user: employer,
    expected: 201,
    payload: {
      title: "Customer service assistant",
      company: "Synthetic Shop",
      location: "Kochi",
      category: "Retail",
      type: "Full-time",
      salaryMin: 12000,
      salaryMax: 16000,
      description:
        "Help customers choose products and organise stock during daytime opening hours.",
      requirements: "Comfortable speaking to customers and arranging products.",
      shift: "Day shift",
      deadline: "",
    },
  });
  assertCheck(created.indexed === true, `job indexing: ${created.indexing}`);
  const stored = await supabase.db.query(
    "select job_version,model from public.job_embeddings where job_id=$1",
    [created.job.id],
  );
  assertCheck(
    stored.rows[0]?.job_version === created.job.version &&
      stored.rows[0]?.model === "gemini-embedding-001",
    "persistent current-version embedding",
  );
  await request("/api/profile", {
    method: "PUT",
    user: candidate,
    payload: {
      confirmed: true,
      profile: {
        name: "Synthetic Candidate",
        location: "Kochi",
        targetRole: "Shop assistant",
        language: "English",
        experience:
          "I helped customers and organised products in a family shop.",
        skills: "Customer service",
        availability: "Day shift",
      },
    },
  });
  const answer = await request("/api/rag", {
    method: "POST",
    user: candidate,
    payload: {
      question: "Find customer service work near Kochi.",
      locale: "en",
    },
  });
  assertCheck(
    answer.mode === "rag" && answer.retrieval === "vector",
    `RAG mode: ${answer.mode}; ${answer.notice}`,
  );
  const citation = answer.points[0]?.citations[0];
  assertCheck(
    citation?.jobId === created.job.id &&
      citation.jobVersion === created.job.version &&
      citation.quote === created.job.description,
    "generated answer cites retrieved live vacancy",
  );
  const forged = await request("/api/rag", {
    method: "POST",
    user: candidate,
    payload: {
      question: "Find customer service work [invalid-citation]",
      locale: "en",
    },
  });
  assertCheck(
    forged.mode === "retrieval" &&
      forged.points[0]?.citations[0]?.field === "title",
    "forged source quote falls back to vacancy facts",
  );
  await request("/api/rag/index", {
    method: "POST",
    user: stranger,
    payload: { jobId: created.job.id },
    expected: 404,
  });
  await request("/api/jobs", {
    method: "PATCH",
    user: employer,
    payload: { id: created.job.id, status: "closed" },
  });
  const closed = await request("/api/rag", {
    method: "POST",
    user: candidate,
    payload: { question: "Find customer service work now.", locale: "en" },
  });
  assertCheck(
    closed.empty === true && closed.jobs.length === 0,
    "closed vacancies excluded from retrieval",
  );
  const usage = await supabase.db.query(
    "select bucket,used from jobsathi_private.ai_daily_usage",
  );
  assertCheck(
    usage.rows.every(
      (row) => row.used <= (row.bucket === "job_embeddings" ? 1000 : 30),
    ),
    "durable provider budgets respected",
  );
  console.log(
    `PASS: ${checks} AI HTTP assertions. Built Next.js routes, actual pgvector/RLS, cached translations, versioned indexing, cited RAG, and invalid-citation fallback. Provider mocked; no external AI requests.`,
  );
} catch (error) {
  console.error(output.slice(-6000));
  throw error;
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
  await supabase.close();
  // Delete only the exact directory allocated above and verified under OS temp.
  const actual = resolve(directory);
  const parent = resolve(tmpdir());
  assert.ok(actual.startsWith(parent + sep) && dirname(actual) === parent);
  await rm(actual, { recursive: true, force: true });
}
