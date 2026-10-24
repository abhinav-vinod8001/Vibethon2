# Verification results — Supabase integration

Updated 25 October 2026. These observations apply to the local Supabase migration
on `codex/portable-hosting`. Hosted infrastructure and external accounts were not
provisioned by these checks.

## Automated scope

| Check | Result / scope |
| --- | --- |
| TypeScript | Pass: source and production build type checks |
| ESLint | Pass: source, scripts, tests, Next.js config |
| Matching unit tests | 6 pass: filters, expiry, keyword ranking, Malayalam tokens, cosine |
| PostgreSQL security/workflow checks | 44 pass: actual migration executed in PGlite with simulated Supabase Auth identities |
| Built Next.js integration | 96 assertions: actual HTTP routes, local simulated Auth/PostgREST gateway, real PostgreSQL policies/RPCs |
| Standalone integration | 96 assertions pass against the packaged server, including PDF fonts and runtime Supabase settings |
| Production build | Pass: Next.js 16.3.4, standalone output and session-refresh proxy |
| CI and Docker | Configuration updated; remote CI and container execution not observed locally |

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
