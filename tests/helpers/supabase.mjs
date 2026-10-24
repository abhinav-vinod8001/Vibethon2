import { createServer } from "node:http";
import { once } from "node:events";
import {
  createHmac,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { createTestDatabase, users } from "./database.mjs";

/** A test-only Auth/PostgREST protocol fixture, backed by actual PostgreSQL RLS.
 * This is deliberately outside application source. It is not hosted Supabase.
 */
export async function startSupabaseFixture({ ai = false } = {}) {
  const db = ai
    ? await (await import("./ai-database.mjs")).createAiTestDatabase()
    : await createTestDatabase();
  const secret = randomBytes(48);
  const refreshTokens = new Map();
  const codes = new Map();
  let databaseDown = false,
    authDown = false;
  const key = "sb_publishable_jobsathi_test";
  const secretKey = "sb_secret_jobsathi_test";
  const cookieName = "sb-127-auth-token";
  function user(id) {
    return {
      id,
      aud: "authenticated",
      role: "authenticated",
      email: `${id}@example.test`,
      app_metadata: { provider: "google" },
      user_metadata: { full_name: "Synthetic Test User" },
      created_at: new Date().toISOString(),
      identities: [],
      is_anonymous: false,
    };
  }
  function session(id, ttl = 3600) {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const head = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        sub: id,
        exp,
        aud: "authenticated",
        role: "authenticated",
      }),
    ).toString("base64url");
    const signed = `${head}.${body}`;
    const token = `${signed}.${createHmac("sha256", secret).update(signed).digest("base64url")}`;
    const refresh = randomBytes(30).toString("hex");
    if (ttl > 0) refreshTokens.set(refresh, id);
    return {
      access_token: token,
      refresh_token: refresh,
      expires_in: ttl,
      expires_at: exp,
      token_type: "bearer",
      user: user(id),
    };
  }
  function verify(token) {
    try {
      const [head, body, sig] = token.split(".");
      const expected = createHmac("sha256", secret)
        .update(`${head}.${body}`)
        .digest();
      const actual = Buffer.from(sig, "base64url");
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        return null;
      const claims = JSON.parse(Buffer.from(body, "base64url"));
      return claims.exp > Date.now() / 1000 &&
        Object.values(users).includes(claims.sub)
        ? claims.sub
        : null;
    } catch {
      return null;
    }
  }
  const rpcDefinitions = {
    save_profile: [
      ["p_profile", "jsonb"],
      ["p_confirmed", "boolean"],
    ],
    create_job: [["p_job", "jsonb"]],
    set_job_status: [
      ["p_job_id", "uuid"],
      ["p_status", "text"],
    ],
    submit_application: [
      ["p_job_id", "uuid"],
      ["p_version", "integer"],
      ["p_confirmed", "boolean"],
    ],
    set_application_status: [
      ["p_application_id", "uuid"],
      ["p_status", "text"],
    ],
  };
  if (ai)
    Object.assign(rpcDefinitions, {
      claim_ai_work: [
        ["p_key", "text"],
        ["p_bucket", "text"],
        ["p_daily_limit", "integer"],
        ["p_lease_seconds", "integer"],
      ],
      finish_ai_work: [
        ["p_key", "text"],
        ["p_success", "boolean"],
      ],
      store_job_embedding: [
        ["p_job_id", "uuid"],
        ["p_version", "integer"],
        ["p_model", "text"],
        ["p_content_hash", "text"],
        ["p_embedding", "jsonb"],
      ],
      match_job_embeddings: [
        ["p_embedding", "jsonb"],
        ["p_model", "text"],
        ["p_location", "text"],
        ["p_category", "text"],
        ["p_type", "text"],
        ["p_limit", "integer"],
        ["p_min_similarity", "double precision"],
      ],
    });
  const server = createServer(async (request, response) => {
    function send(status, data) {
      response.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(data));
    }
    try {
      const url = new URL(request.url, "http://fixture.test");
      const token = request.headers.authorization?.replace(/^Bearer /i, "");
      const id = token ? verify(token) : null;
      const isService =
        ai && request.headers.apikey === secretKey && token === secretKey;
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const input = raw ? JSON.parse(raw) : {};
      if (request.headers.apikey !== key && !isService)
        return send(401, { message: "Invalid API key" });
      if (url.pathname.startsWith("/auth/v1/")) {
        if (authDown)
          return send(503, {
            code: "unexpected_failure",
            msg: "Auth unavailable",
          });
        if (url.pathname === "/auth/v1/user") {
          return id
            ? send(200, user(id))
            : send(401, { code: "bad_jwt", msg: "Invalid token" });
        }
        if (url.pathname === "/auth/v1/logout") {
          for (const [refresh, owner] of refreshTokens)
            if (owner === id) refreshTokens.delete(refresh);
          return send(200, {});
        }
        if (url.pathname === "/auth/v1/token") {
          if (url.searchParams.get("grant_type") === "refresh_token") {
            const owner = refreshTokens.get(input.refresh_token);
            if (!owner)
              return send(400, {
                code: "refresh_token_not_found",
                msg: "Invalid refresh token",
              });
            refreshTokens.delete(input.refresh_token);
            return send(200, session(owner));
          }
          const code = codes.get(input.auth_code);
          if (
            !code ||
            !input.code_verifier ||
            createHash("sha256")
              .update(input.code_verifier)
              .digest("base64url") !== code.challenge
          )
            return send(400, {
              code: "bad_code_verifier",
              msg: "Invalid verifier",
            });
          codes.delete(input.auth_code);
          return send(200, session(code.id));
        }
        return send(404, { message: "Unknown Auth fixture route" });
      }
      if (databaseDown)
        return send(503, { code: "PGRST000", message: "Database unavailable" });
      // The publishable key identifies a guest, not a signed-in user.
      if (token && token !== key && !id && !isService)
        return send(401, { code: "PGRST301", message: "Invalid JWT" });
      const result = await db.transaction(async (transaction) => {
        await transaction.exec(
          `set local role ${isService ? "service_role" : id ? "authenticated" : "anon"}`,
        );
        await transaction.query(
          "select set_config('request.jwt.claim.sub', $1, true)",
          [id || ""],
        );
        if (url.pathname.startsWith("/rest/v1/rpc/")) {
          const name = url.pathname.split("/").at(-1);
          const definition = rpcDefinitions[name];
          if (!definition) throw new Error("Unknown RPC fixture route");
          const placeholders = definition
            .map(([, type], i) => `$${i + 1}::${type}`)
            .join(",");
          const args = definition.map(([field, type]) =>
            type === "jsonb" ? JSON.stringify(input[field]) : input[field],
          );
          if (name === "match_job_embeddings")
            return (
              await transaction.query(
                `select * from public.${name}(${placeholders})`,
                args,
              )
            ).rows;
          return (
            await transaction.query(
              `select public.${name}(${placeholders}) as data`,
              args,
            )
          ).rows[0].data;
        }
        const table = url.pathname.split("/").at(-1);
        if (
          ![
            "profiles",
            "jobs",
            "applications",
            ...(ai
              ? ["app_languages", "ui_translations", "job_embeddings"]
              : []),
          ].includes(table)
        )
          throw new Error("Unknown table fixture route");
        if (ai && table === "ui_translations" && request.method === "POST") {
          if (!isService)
            throw Object.assign(
              new Error("Cache writes require service_role."),
              { code: "42501" },
            );
          const fields = [
            "cache_key",
            "locale",
            "source_hash",
            "model",
            "prompt_version",
            "messages",
            "updated_at",
          ];
          if (
            !input ||
            Array.isArray(input) ||
            Object.keys(input).some((field) => !fields.includes(field))
          )
            throw new Error("Unsupported fixture upsert");
          await transaction.query(
            `insert into public.ui_translations(${fields.join(",")}) values($1,$2,$3,$4,$5,$6::jsonb,$7::timestamptz)
             on conflict(cache_key) do update set messages=excluded.messages,updated_at=excluded.updated_at`,
            fields.map((field) =>
              field === "messages"
                ? JSON.stringify(input[field])
                : input[field],
            ),
          );
          return [];
        }
        if (request.method !== "GET")
          throw new Error("Fixture supports table reads only");
        const args = [],
          filters = [];
        const related = url.searchParams.get("select")?.includes("jobs!inner");
        for (const [column, value] of url.searchParams) {
          if (
            ["select", "order", "limit", "or", "on_conflict"].includes(column)
          )
            continue;
          if (
            !/^(?:[a-z_]+|jobs.owner_id)$/.test(column) ||
            !value.startsWith("eq.")
          )
            throw new Error("Unsupported fixture filter");
          args.push(value.slice(3));
          filters.push(
            `${column === "jobs.owner_id" ? "j.owner_id" : `t.${column}`} = $${args.length}`,
          );
        }
        if (url.searchParams.has("or")) {
          const match = url.searchParams
            .get("or")
            .match(/^\(deadline.is.null,deadline.gte.(\d{4}-\d{2}-\d{2})\)$/);
          if (!match) throw new Error("Unsupported fixture OR filter");
          args.push(match[1]);
          filters.push(
            `(t.deadline is null or t.deadline >= $${args.length}::date)`,
          );
        }
        const limit = Number(url.searchParams.get("limit") || 1000);
        if (!Number.isSafeInteger(limit) || limit < 0)
          throw new Error("Invalid fixture limit");
        const order = url.searchParams.get("order");
        if (
          order &&
          order !== "created_at.desc" &&
          !(
            ai &&
            ["sort_order.asc,code.asc", "sort_order.asc", "code.asc"].includes(
              order,
            )
          )
        )
          throw new Error("Unsupported fixture order");
        const query = `select t.* ${related ? ", jsonb_build_object('owner_id', j.owner_id) as jobs" : ""}
          from public.${table} t ${related ? "join public.jobs j on j.id=t.job_id" : ""}
          ${filters.length ? "where " + filters.join(" and ") : ""}
          ${
            order
              ? "order by " +
                order
                  .split(",")
                  .map((entry) => {
                    const [column, direction] = entry.split(".");
                    return `t.${column} ${direction}`;
                  })
                  .join(",")
              : ""
          } limit ${limit}`;
        return (await transaction.query(query, args)).rows;
      });
      return send(200, result);
    } catch (error) {
      if (!error.code) console.error("Supabase fixture error", error);
      return send(error.code === "42501" ? 403 : 400, {
        code: error.code || "fixture_error",
        message: error.message,
      });
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    db,
    url: `http://127.0.0.1:${server.address().port}`,
    key,
    ...(ai ? { secretKey } : {}),
    users,
    cookieName,
    session,
    cookie(id, ttl = 3600) {
      return `${cookieName}=base64-${Buffer.from(JSON.stringify(session(id, ttl))).toString("base64url")}`;
    },
    issueCode(id, challenge) {
      const code = randomBytes(16).toString("hex");
      codes.set(code, { id, challenge });
      return code;
    },
    databaseOutage(value) {
      databaseDown = value;
    },
    authOutage(value) {
      authDown = value;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
