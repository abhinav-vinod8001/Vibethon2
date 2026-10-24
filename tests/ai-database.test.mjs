import assert from "node:assert/strict";
import { createAiTestDatabase, users } from "./helpers/ai-database.mjs";

const db = await createAiTestDatabase();
let checks = 0;
const eq = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const denied = async (action, code = "42501") => {
  await assert.rejects(action, (error) => {
    assert.equal(error.code, code);
    return true;
  });
  checks++;
};
const role = async (name, id = "") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec(`set role ${name}`);
};
const count = async (table) =>
  Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n);
const vector = (first = 1, second = 0) => [
  first,
  second,
  ...Array(766).fill(0),
];
const embedding = JSON.stringify(vector());
const store = async (
  job,
  values = embedding,
  model = "test-768",
  version = job.version,
) =>
  (
    await db.query(
      "select public.store_job_embedding($1::uuid,$2::integer,$3::text,$4::text,$5::jsonb) as ok",
      [job.id, version, model, "test-public-job-content-hash", values],
    )
  ).rows[0].ok;
const match = async ({
  values = embedding,
  model = "test-768",
  location = "",
  category = "",
  type = "",
  limit = 5,
  min = 0.25,
} = {}) =>
  (
    await db.query(
      "select * from public.match_job_embeddings($1::jsonb,$2::text,$3::text,$4::text,$5::text,$6::integer,$7::double precision)",
      [values, model, location, category, type, limit, min],
    )
  ).rows;
const claim = async (
  key,
  bucket = "job_embeddings",
  limit = 1000,
  lease = 120,
) =>
  (
    await db.query(
      "select public.claim_ai_work($1::text,$2::text,$3::integer,$4::integer) as ok",
      [key, bucket, limit, lease],
    )
  ).rows[0].ok;
const finish = (key, success) =>
  db.query("select public.finish_ai_work($1::text,$2::boolean)", [
    key,
    success,
  ]);
const newJob = async (overrides = {}) => {
  const input = {
    title: "Retail assistant",
    company: "Public Test Shop",
    location: "Kochi",
    category: "Retail",
    type: "Full-time",
    salaryMin: 10000,
    salaryMax: 20000,
    description: "Help shop customers and maintain the shop floor.",
    requirements: "Customer service experience",
    shift: "Day shift",
    deadline: "",
    ...overrides,
  };
  return (
    await db.query("select public.create_job($1::jsonb) as job", [
      JSON.stringify(input),
    ])
  ).rows[0].job;
};

try {
  await role("anon");
  eq(await count("public.app_languages"), 5);
  eq(await count("public.ui_translations"), 0);
  await denied(() =>
    db.exec("update public.app_languages set enabled=false where code='ml'"),
  );
  await denied(() => db.exec("delete from public.ui_translations"));
  await denied(() => count("public.job_embeddings"));
  await denied(() => match());
  await denied(() => claim("browser-untrusted"));
  await denied(() => finish("browser-untrusted", true));
  await denied(() =>
    db.query("select jobsathi_private.validated_embedding($1::jsonb)", [
      embedding,
    ]),
  );
  await role("authenticated");
  await denied(() => match());
  await role("authenticated", users.employer);
  const job = await newJob();
  const closed = await newJob({ title: "Closed shop vacancy" });
  const expired = await newJob({ title: "Expired shop vacancy" });
  const stale = await newJob({ title: "Stale shop vacancy" });
  const other = await newJob({ title: "Other model vacancy" });
  const different = await newJob({
    title: "Distant kitchen worker",
    location: "Chennai",
    category: "Hospitality",
    type: "Part-time",
  });
  await denied(() => store(job));
  await denied(() => claim("owner-is-not-service"));
  await denied(() =>
    db.exec(
      "insert into public.job_embeddings select * from public.job_embeddings",
    ),
  );
  await role("service_role");
  await db.query(
    `insert into public.ui_translations(cache_key,locale,source_hash,model,prompt_version,messages)
    values($1,'ml','source-sha','test-model','v1',$2::jsonb)`,
    ["ml-v1", JSON.stringify({ login: "സൈൻ ഇൻ" })],
  );
  eq(await store(job), true);
  eq(await store(closed), true);
  eq(await store(expired), true);
  eq(await store(stale), true);
  eq(await store(other, embedding, "another-model"), true);
  eq(await store(different, JSON.stringify(vector(0, 1))), true);
  await denied(() => store(job, "[]"), "22023");
  await denied(() => store(job, JSON.stringify(Array(768).fill(0))), "22023");
  await denied(
    () => store(job, JSON.stringify(["NaN", ...Array(767).fill(0)])),
    "22023",
  );
  await denied(
    () => store(job, "[1e1000," + Array(767).fill("0").join(",") + "]"),
    "22023",
  );
  eq(await store(job, embedding, "test-768", 99), false);

  await role("postgres");
  await db.query(
    "update public.jobs set status='closed',version=version+1 where id=$1",
    [closed.id],
  );
  await db.query("update public.jobs set deadline='2000-01-01' where id=$1", [
    expired.id,
  ]);
  await db.query("update public.jobs set version=version+1 where id=$1", [
    stale.id,
  ]);
  eq(await count("public.job_embeddings"), 3);
  // Simulate a stale/corrupt privileged import: retrieval must independently
  // enforce state, deadline and version rather than trust invalidation alone.
  for (const old of [closed, expired, stale])
    await db.query(
      `insert into public.job_embeddings(job_id,job_version,model,content_hash,embedding)
      values($1,$2,'test-768','stale-import',$3::extensions.vector)`,
      [old.id, old.version, embedding],
    );
  await role("service_role");
  eq(await store(closed), false);
  eq(await store(expired), false);
  eq(await store(stale), false);
  await role("anon");
  eq(await count("public.ui_translations"), 1);
  await role("authenticated", users.candidate);
  eq(await match(), [{ id: job.id, similarity: 1, job_version: 1 }]);
  eq(await match({ location: "KOCH", category: "Retail", type: "Full-time" }), [
    { id: job.id, similarity: 1, job_version: 1 },
  ]);
  eq(await match({ location: "Chennai" }), []);
  eq(await match({ category: "Hospitality" }), []);
  eq(await match({ type: "Part-time" }), []);
  eq(await match({ model: "nonexistent" }), []);
  eq((await match({ min: -1, limit: 1 })).length, 1);
  eq((await match({ min: -1, limit: 0 })).length, 1);
  eq((await match({ min: -1, limit: 999 })).length, 2);
  await denied(() => match({ values: "{}" }), "22023");
  await denied(() => match({ min: "NaN" }), "22023");
  // An owner sees their closed jobs through ordinary jobs RLS but retrieval
  // must not expose these as current vacancies, even to that same owner.
  await role("authenticated", users.employer);
  eq(await match(), [{ id: job.id, similarity: 1, job_version: 1 }]);
  await role("service_role");
  await db.exec(
    "update public.app_languages set enabled=false where code='ml'",
  );
  await role("anon");
  eq(await count("public.app_languages"), 4);
  eq(await count("public.ui_translations"), 0);

  await role("service_role");
  const sameKey = await Promise.all(
    Array.from({ length: 8 }, () => claim("one-concurrent-key")),
  );
  eq(sameKey.filter(Boolean).length, 1);
  await finish("one-concurrent-key", true);
  eq(await claim("one-concurrent-key"), false);
  eq(await claim("failed-key"), true);
  await finish("failed-key", false);
  eq(await claim("failed-key"), false);
  await role("postgres");
  await db.exec(
    "update jobsathi_private.ai_work set retry_after=now()-interval '1 second' where work_key='failed-key'",
  );
  await role("service_role");
  eq(await claim("failed-key"), true);
  eq(await claim("abandoned-key"), true);
  await role("postgres");
  await db.exec(
    "update jobsathi_private.ai_work set lease_until=now()-interval '1 second' where work_key='abandoned-key'",
  );
  await role("service_role");
  eq(await claim("abandoned-key"), true);
  const quota = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      claim(`translation-${i}`, "translations", 2),
    ),
  );
  eq(quota.filter(Boolean).length, 2);
  eq(await claim("translations-exhausted", "translations", 2), false);
  await denied(() => claim("invalid-bucket", "arbitrary", 1), "22023");
  await denied(() => claim("invalid-rag-id", "rag:not-a-user", 1), "22023");
  await denied(() => claim("one-concurrent-key", "translations", 2), "22023");
  const userBucket = `rag:${users.candidate}`;
  const perUser = await Promise.all(
    Array.from({ length: 33 }, (_, i) => claim(`rag-${i}`, userBucket, 999)),
  );
  eq(perUser.filter(Boolean).length, 30);
  eq(await claim("different-user", `rag:${users.stranger}`, 1), true);
  await role("authenticated", users.candidate);
  await denied(() => count("jobsathi_private.ai_work"));
  await denied(() => count("jobsathi_private.ai_daily_usage"));
  console.log(
    `PASS: ${checks} pgvector, translation RLS, lease, budget and retrieval checks.`,
  );
} finally {
  await db.close();
}
