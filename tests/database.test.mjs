import assert from "node:assert/strict";
import {
  createTestDatabase,
  migration as sql,
  users,
} from "./helpers/database.mjs";

const db = await createTestDatabase();
let checks = 0;
const { employer: owner, candidate, stranger } = users;
checks++;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const denied = async (action, code) => {
  await assert.rejects(action, (e) => {
    assert.equal(e.code, code);
    return true;
  });
  checks++;
};
const role = async (name, id = "") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec(`set role ${name}`);
};
const rpc = async (name, args, casts) => {
  const params = args.map((_, i) => `$${i + 1}::${casts[i]}`).join(",");
  return (await db.query(`select public.${name}(${params}) as result`, args))
    .rows[0].result;
};
const count = async (table) =>
  Number(
    (await db.query(`select count(*) as n from public.${table}`)).rows[0].n,
  );
const profile = {
  name: "Test Candidate",
  location: "Kochi",
  targetRole: "Shop assistant",
  language: "Malayalam",
  experience: "Two years helping retail customers.",
  skills: "Customer service",
  availability: "Immediately",
};
const jobInput = {
  title: "Retail assistant",
  company: "Test Employer",
  location: "Kochi",
  category: "Retail",
  type: "Full-time",
  salaryMin: 10000,
  salaryMax: 20000,
  description: "Help customers and maintain the shop floor.",
  requirements: "Customer service experience",
  shift: "Day shift",
  deadline: "",
};
eq(
  (
    await db.query(
      "select count(*)::integer as n from pg_class where relnamespace='public'::regnamespace and relname in ('profiles','jobs','applications') and relrowsecurity",
    )
  ).rows[0].n,
  3,
);
await role("anon");
eq(await count("jobs"), 0);
await denied(() => count("profiles"), "42501");
await denied(
  () => rpc("create_job", [JSON.stringify(jobInput)], ["jsonb"]),
  "42501",
);
await role("authenticated");
await denied(
  () =>
    rpc("save_profile", [JSON.stringify(profile), true], ["jsonb", "boolean"]),
  "42501",
);
await role("authenticated", owner);
await denied(
  () =>
    rpc(
      "create_job",
      [JSON.stringify({ ...jobInput, salaryMax: 1 })],
      ["jsonb"],
    ),
  "23514",
);
await denied(
  () =>
    rpc(
      "create_job",
      [JSON.stringify({ ...jobInput, deadline: "2000-01-01" })],
      ["jsonb"],
    ),
  "22023",
);
const job = await rpc(
  "create_job",
  [JSON.stringify({ ...jobInput, owner_id: stranger })],
  ["jsonb"],
);
eq(job.owner_id, owner);
eq(job.version, 1);
await denied(
  () =>
    db.query("update public.jobs set status=$1 where id=$2", [
      "closed",
      job.id,
    ]),
  "42501",
);
await role("anon");
eq(await count("jobs"), 1);
await role("authenticated", candidate);
await denied(
  () =>
    rpc(
      "submit_application",
      [job.id, 1, true],
      ["uuid", "integer", "boolean"],
    ),
  "22023",
);
await denied(
  () =>
    rpc("save_profile", [JSON.stringify(profile), false], ["jsonb", "boolean"]),
  "22023",
);
await denied(
  () =>
    rpc(
      "save_profile",
      [JSON.stringify({ ...profile, name: "A" }), true],
      ["jsonb", "boolean"],
    ),
  "23514",
);
const saved = await rpc(
  "save_profile",
  [JSON.stringify({ ...profile, user_id: owner }), true],
  ["jsonb", "boolean"],
);
eq(saved.user_id, candidate);
await denied(
  () =>
    rpc(
      "submit_application",
      [job.id, 2, true],
      ["uuid", "integer", "boolean"],
    ),
  "40001",
);
await denied(
  () =>
    rpc(
      "submit_application",
      [job.id, 1, false],
      ["uuid", "integer", "boolean"],
    ),
  "22023",
);
const application = await rpc(
  "submit_application",
  [job.id, 1, true],
  ["uuid", "integer", "boolean"],
);
eq(application.snapshot, profile);
eq(application.candidate_id, candidate);
await denied(
  () =>
    rpc(
      "submit_application",
      [job.id, 1, true],
      ["uuid", "integer", "boolean"],
    ),
  "23505",
);
await rpc(
  "save_profile",
  [JSON.stringify({ ...profile, name: "Changed Candidate" }), true],
  ["jsonb", "boolean"],
);
eq(
  (await db.query("select snapshot from public.applications")).rows[0].snapshot
    .name,
  "Test Candidate",
);
await denied(
  () =>
    rpc(
      "set_application_status",
      [application.id, "shortlisted"],
      ["uuid", "text"],
    ),
  "42501",
);
await denied(
  () =>
    db.query("update public.applications set snapshot=$1", [
      JSON.stringify({ name: "Forged" }),
    ]),
  "42501",
);
await denied(
  () => rpc("set_job_status", [job.id, "closed"], ["uuid", "text"]),
  "P0002",
);
await role("authenticated", stranger);
eq(await count("profiles"), 0);
eq(await count("applications"), 0);
await denied(
  () =>
    rpc(
      "set_application_status",
      [application.id, "withdrawn"],
      ["uuid", "text"],
    ),
  "42501",
);
await role("authenticated", owner);
eq(await count("applications"), 1);
eq(await count("profiles"), 0);
eq(
  (
    await rpc(
      "set_application_status",
      [application.id, "shortlisted"],
      ["uuid", "text"],
    )
  ).status,
  "shortlisted",
);
await denied(
  () =>
    rpc(
      "set_application_status",
      [application.id, "withdrawn"],
      ["uuid", "text"],
    ),
  "42501",
);
eq(
  (await rpc("set_job_status", [job.id, "closed"], ["uuid", "text"])).version,
  2,
);
eq(await count("jobs"), 1);
await role("authenticated", stranger);
eq(await count("jobs"), 0);
await denied(
  () =>
    rpc(
      "submit_application",
      [job.id, 2, true],
      ["uuid", "integer", "boolean"],
    ),
  "40001",
);
await role("anon");
eq(await count("jobs"), 0);
await role("authenticated", candidate);
eq(await count("jobs"), 1);
eq(
  (
    await rpc(
      "set_application_status",
      [application.id, "withdrawn"],
      ["uuid", "text"],
    )
  ).status,
  "withdrawn",
);
await role("authenticated", owner);
await denied(
  () =>
    rpc(
      "set_application_status",
      [application.id, "contacted"],
      ["uuid", "text"],
    ),
  "22023",
);
await rpc("set_job_status", [job.id, "active"], ["uuid", "text"]);
await role("postgres");
await db.query("update public.jobs set deadline='2000-01-01' where id=$1", [
  job.id,
]);
await role("anon");
eq(await count("jobs"), 0);
await role("authenticated", stranger);
await denied(
  () =>
    rpc(
      "submit_application",
      [job.id, 3, true],
      ["uuid", "integer", "boolean"],
    ),
  "40001",
);
await role("postgres");
await denied(() => db.exec(sql), "42P06");
await db.exec("rollback");
eq(await count("jobs"), 1);
console.log(
  `${checks} PostgreSQL schema, RLS, permissions, and workflow checks passed (PGlite with mocked Supabase Auth).`,
);
await db.close();
