# Verification results

## Pre-push verification — 25 October 2026

Local verification for the API translation cache, database language registry,
durable vacancy index, and cited retrieval-and-generation search:

- Full TypeScript, ESLint, and the Next.js production build passed.
- All 17 feature tests passed: 6 matching, 2 multilingual PDF, and the 9
  translation/grounding checks described below.
- 9 focused translation/grounding tests passed: complete manifests, placeholder
  preservation, cache validation, exact current-version citations, rejected
  fabricated quotes, and valid 768-dimensional vectors.
- 59 checks executed migration 002 in PostgreSQL with pgvector: language/cache
  RLS, denied public index writes, version/expiry filters, invalidation, shared
  leases and daily work budgets.
- All 44 original PostgreSQL security/workflow checks passed as well.
- 29 built-server AI HTTP assertions passed against the actual SQL/pgvector
  fixture. These covered free translation GETs, persisted API translations,
  repeated-request deduplication, persistent job indexing, generated cited
  answers, invalid-citation fallback, ownership denial, and closed-job exclusion.
  Gemini responses were mocked only in the test subprocess, outside app source.
- All 96 existing built-server integration assertions passed, covering the core
  authentication, profile, job, application and PDF flows.
- All 96 standalone integration assertions passed against the packaged server.
- The Vercel-mode adapter build passed, including default output and PDF font
  tracing. Both normal and adapter builds included the new API routes.
- A credential-pattern scan of 112 text files found no credentials to publish;
  the populated local environment file remains ignored.
- The earlier local browser screenshot confirmed the original green/cream
  language grid; this final verification did not redesign the interface.

No real Gemini/Sarvam calls, cloud migration or index backfill were performed by
these checks. The user reports applying migration 002; hosted configuration and
provider behavior were not independently verified. Real translation quality,
multilingual retrieval relevance, hosted pgvector behavior and concurrent
serverless usage still need staging validation. Citation checks establish source
traceability, not semantic truth. Activation steps are in
[AI setup](../docs/AI_SETUP.md). The observations below describe earlier checks.

## Multilingual onboarding update — 25 October 2026

Focused verification for the language-first entry and guided resume update:

- Production build (including TypeScript) and full ESLint passed.
- Two multilingual PDF tests passed: each of the five locale fonts and a mixed
  five-script profile spanning pages. Representative PDF pages were rendered and
  inspected locally for clipping and overlapping lines.
- All 96 built-server integration assertions passed against the existing local
  simulated Supabase/PostgREST gateway. No live AI/Google requests were made.
- Browser preview confirmed first-visit language selection before sign-in, Tamil
  sign-in text, preference persistence after refresh, translated navigation and
  responsive layout. A narrow-layout overlap was corrected and checked again.

The unchanged database/matching suites and second standalone/adapter builds were
not repeated for this update. A real signed-in six-question journey, actual phone
microphones, Google redirect persistence, native-speaker review, and provider
output quality still need staging validation. No changes were pushed or deployed.

The earlier Supabase migration verification below remains historical evidence.

Updated 25 October 2026. These observations apply to the local Supabase migration
on `codex/portable-hosting`. Hosted infrastructure and external accounts were not
provisioned by these checks.

## Automated scope

| Check                               | Result / scope                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                          | Pass: source and production build type checks                                                                                          |
| ESLint                              | Pass: source, scripts, tests, Next.js config                                                                                           |
| Matching unit tests                 | 6 pass: filters, expiry, keyword ranking, Malayalam tokens, cosine                                                                     |
| PostgreSQL security/workflow checks | 44 pass: actual migration executed in PGlite with simulated Supabase Auth identities                                                   |
| Built Next.js integration           | 96 assertions: actual HTTP routes, local simulated Auth/PostgREST gateway, real PostgreSQL policies/RPCs                               |
| Standalone integration              | 96 assertions pass against the packaged server, including PDF fonts and runtime Supabase settings                                      |
| Production build                    | Pass: Next.js 16.3.4, standalone output and session-refresh proxy                                                                      |
| Vercel-mode adapter regression      | Pass after fix: adapter build with VERCEL=1, default output, and traced PDF font; original config reproduced the reported ENOENT first |
| CI and Docker                       | Configuration updated; remote CI and container execution not observed locally                                                          |

The integration suite tests PKCE sign-in URL/callback exchange, fixed return URL,
failed login, verified user lookup, cookie metadata spoofing, token refresh,
logout cookie clearing, cross-origin auth/write rejection, invalid/expired
sessions, two-account workflows, immutable snapshots, duplicate and stale/closed
applications, withdrawal rules, keyword fallback, AI-unconfigured behavior, PDF
responses, configured database outages, and a separate process with no Supabase
configuration. No test bypass exists in production source.

Both server suites passed after a production build with the blank local template.
This catches accidental build-time inlining of Supabase settings: the same build
accepts the fixture's runtime settings and then serves the unconfigured sample
workspace in another process. Runtime reads use Reflect rather than a process.env
alias, which this Turbopack version otherwise inlined. A stale OneDrive build-cache
directory was archived under the user's temporary directory before the clean
build; generated temporary/output folders are excluded from TypeScript input.

PGlite executes PostgreSQL, but the Auth service and the limited PostgREST HTTP
surface are test fixtures. Tests do not establish compatibility with every hosted
gateway feature, exercise real Google consent, prove distributed concurrency, or
test a real TLS database connection. The optional migration runner's live hosted
connection remains a staging check.

## Vercel packaging failure and fix

The supplied Vercel log for commit c46a2ea showed compilation, TypeScript and
static generation succeeding, followed by a missing `.next/next-server.js.nft.json`
error. The same failure was reproduced locally with NEXT_ADAPTER_PATH set to a
minimal adapter and the original unconditional standalone output.

Next 16.3 suppresses the whole-server trace for adapters, but standalone packaging
still reads it. The config now leaves output at the platform default when
VERCEL=1 and retains standalone output for local/Node/Docker builds. The new
`pnpm test:vercel-build` passes the previously failing adapter path and checks the
PDF font's route trace. Node is pinned to 22.x, matching CI/Docker; the engine
warning in the log was separate from the missing-file failure.

Reference: [Next.js issue #96646](https://github.com/vercel/next.js/issues/96646).
This local fixture exercises the Next adapter lifecycle, not Vercel's full cloud
packager. The new commit still needs its own hosted deployment result.

## PDF scope

The updated integration generates English, Malayalam and long-profile PDFs and
checks owner-only export, query-parameter isolation, attachment/content type, and
private/no-store headers. The PDF renderer/font were not changed by this database
migration. Earlier visual/text QA inspected one-page English/Malayalam and a
three-page long profile, embedded fonts, omitted empty skills, and retained the
final experience line. Malayalam extraction may reorder combining characters;
no universal ATS/parser compatibility is claimed.

## Required hosted staging checks

- Apply SQL once in a fresh Supabase project; inspect RLS/grants and verify actual
  publishable-key Data API and write RPC behavior.
- Two real Google accounts: sign in, reload, refresh, sign out, complete hiring,
  verify private records, reject stale/closed/expired/duplicate submissions, and
  download each account's own PDF.
- Verify persistence after Vercel redeployment and isolation from production data.
- Exercise concurrent close/apply and duplicate application transactions on hosted
  PostgreSQL. SQL uses a job lock and uniqueness constraint; local tests cover
  the resulting rules but do not simulate multiple independent database clients.
- Test real Gemini/Sarvam access, exact model IDs, provider quotas, Malayalam
  recordings, evidence quality, and semantic versus keyword results.
- Test mobile/keyboard flows, microphone denial/cancellation, and preserved edits.
- Test optional TLS migration runner, Docker image, and GitHub Actions remotely.
- Before any old-data import, back up SQLite/D1 and verify explicit identity
  mapping, snapshots, ownership, counts, and rollback.

## Retrieval smoke log

Label acceptable jobs before comparing keyword/semantic results. Include unrelated
and no-match queries. Record actual mode, timings and observed failures; never
count keyword fallback as semantic success. This evaluation has not been run
against real providers and makes no hiring accuracy or fairness claim.

## Recovery

Earlier implementations remain in Git history and historical reviews in
`docs/archive`. Local `.data` databases were not deleted or automatically imported.
No live accounts, credentials, or hosted records were migrated. Secrets remain in
ignored environment files or deployment settings.
