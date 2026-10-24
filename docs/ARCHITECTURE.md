# Architecture

JobSathi runs on standard Next.js 16/Node.js with Supabase PostgreSQL and Supabase
Auth. Gemini and Sarvam run behind server routes. The app has no Sites/Workers/D1
runtime or trusted identity-header dependency.

Vercel uses its adapter-managed build output. Outside Vercel the config emits
standalone output for Node/Docker. This avoids Next 16.3's adapter/standalone
tracing conflict; CI also exercises a minimal adapter build. Node is pinned to
the 22.x major across the package, CI and Docker.

## Request flow

Browser → Next.js route → Supabase-verified user → domain validation →
user-scoped Supabase Data API/RPC → PostgreSQL access policies → response.

`src/proxy.ts` refreshes Supabase sessions and forwards updated cookies to the
request and browser. `src/server/auth.ts` calls Auth `getUser()` to verify identity;
it never authorizes from an unverified cookie user object. Clients are constructed
per request, not cached globally. Responses carrying sessions are private/no-store.
The browser uses Next.js routes; session cookies are HTTP-only.

Sign-in is a same-origin POST returning the Google OAuth URL. `/auth/callback`
exchanges the PKCE code and redirects only to configured APP_URL. Sign-out is a
same-origin POST using Supabase local-session logout. Google provider secrets
live in Supabase's dashboard. Profiles and ownership use Supabase user UUIDs.

## Data access

The initial SQL in `supabase/migrations` defines profiles, jobs, applications,
constraints, indexes, read policies and checked write functions. API roles have
no direct INSERT/UPDATE/DELETE privileges. Five authenticated RPCs save confirmed
profiles, create jobs, change job status, submit applications, and change
application status. They explicitly check auth.uid()/ownership, use an empty
search path, and cannot be executed by anonymous clients.

Application insertion locks the current job against concurrent status updates,
checks its version/expiry/status, copies the saved profile, and enforces one
application per candidate/job. Snapshots cannot be overwritten through public
APIs. Only candidates withdraw; only owners shortlist/contact; withdrawn records
cannot change. Narrow private helpers avoid mutually recursive RLS policies.

Profiles are owner-only. Employers see submitted snapshots for their jobs.
Active unexpired vacancies are public; owners/applicants can still read their
related closed/expired jobs. There is no separate candidate/employer role: one
account can perform either workflow, matching the existing product.

Native PostgreSQL dates, timestamps and JSON are mapped to the existing frontend
types by server adapters. Empty deadlines are stored as NULL. Core user reads and
writes carry the verified user's JWT and respect RLS. A separate optional
server-only privileged client writes public-content AI caches/indexes and calls
work-lease RPCs; it is never used for profile/application CRUD. Migrations run
separately through SQL Editor or the checked PostgreSQL runner. Migration 002
defines the optional translation cache, vector index and durable work limits.

## Source boundaries

| Directory              | Responsibility                                                   |
| ---------------------- | ---------------------------------------------------------------- |
| src/app                | Pages, route handlers, OAuth callback                            |
| src/features/workspace | Candidate/employer interface, forms, client requests             |
| src/features/language  | Cookie-backed language selection and localized sign-in           |
| src/features/resume    | Single-question resume wizard and cancellable voice capture      |
| src/i18n               | Approved UI manifests, five language capabilities and fallbacks  |
| src/components         | Shared dialog and form fields                                    |
| src/domain             | Validation, matching, samples and product types                  |
| src/server/supabase    | Connection config, cookie client and database types              |
| src/server             | Identity, database operations, translation cache, AI and PDF     |
| src/server/rag         | Public job documents, indexing, retrieval, budgets and citations |
| supabase/migrations    | Versioned PostgreSQL schema, policies and RPCs                   |
| tests                  | Matching, PostgreSQL security and built-server integration       |

## AI and PDF

The root layout reads the allowlisted `jobsathi_locale` preference cookie so the
initial HTML language and client interface agree. Signed-out visitors start with
a language tile grid (last choice highlighted), then a compact sign-in card.
English, Malayalam, Tamil, Hindi and
Telugu use the existing route URLs; OAuth callbacks do not need new redirect
configuration. The cookie contains only a language code, never resume answers.
The shared bootstrap provider avoids duplicate session/data requests between the
entry screen and workspace. Profile language and interface locale are separate:
changing UI language never rewrites saved answers or application snapshots.

Resume questions map to the existing six profile fields. Back/Next retains
answers in component memory, step validation precedes review, and explicit
confirmation precedes the existing save RPC. No personal drafts are persisted on
the shared device. Voice capture is scoped to question/language, cancelled on
navigation/unmount, and inserts only an explicitly accepted transcript. AI labels
and explanations use the selected locale; exact evidence quotes remain verbatim.

`GET /api/languages` reads enabled `app_languages` entries; capabilities remain
allowlisted to English, Malayalam, Tamil, Hindi and Telugu so a database row
cannot promise unsupported speech/fonts. `GET /api/translations` reads approved
bundles without provider calls. A same-origin POST can generate a missing bundle
through Gemini, validate its keys/placeholders, and publish it to Supabase.
Keys include locale, source hash, prompt version and model. English source text
and bundled dictionaries keep onboarding usable when an API fails; user records
are never submitted for UI translation. See [AI setup](AI_SETUP.md).

Keyword/manual flows need no AI keys. Trusted indexing embeds public vacancy
fields at 768 dimensions and stores them in `job_embeddings` with job version,
model and content hash. It runs after new/reopened job saves; failure leaves the
saved job available through keyword search. Existing jobs are indexed by the
explicit `pnpm ai:index` tool. There is no background daemon or indexing on build.

Semantic searches embed only the query and use authenticated
`match_job_embeddings` with pgvector cosine retrieval and explicit filters.
The RPC excludes closed/expired jobs and mismatched versions/models, and the
server rechecks fetched versions. Job updates invalidate old index rows. Candidate
profiles, applications and query vectors are not stored in the public index.

`POST /api/rag` retrieves up to five current real jobs, supplies those sources to
Gemini, and validates job ID, version, source field and exact quote for every
answer point. The current user's saved experience/skills may supply prompt
context under RLS; they never establish vacancy facts. A final database reread
removes sources that changed during generation. Provider/validation failures
produce explicit keyword or source-fact fallbacks, not invented vacancies.
Quote containment is a traceability check, not proof of correctness or hiring
eligibility. Real relevance and translation quality still require evaluation.

Database leases deduplicate work across serverless instances. Daily UTC limits
are 30 translation bundle claims, 1,000 job-index claims, and 30 RAG claims per
user. A query embedding and an answer each consume one RAG claim; a translation
bundle can contain multiple provider requests. Failed attempts consume claims,
back off for 15 minutes, and abandoned leases expire. These bounds cover these
new workflows, not every legacy AI route or a guaranteed monetary spend limit.

`GET /api/profile/resume` verifies the user, loads their confirmed saved profile
under RLS, and renders an in-memory PDF. A query-string user ID cannot change the
owner. PDFs have private/no-store headers and are not retained. Noto Indic
fonts and the documented fontkit patch remain bundled in standalone output.

## Verification boundaries

PGlite tests execute the real migration with simulated Auth identities. Built
Next.js integration tests use a local Auth/PostgREST protocol fixture backed by
that PostgreSQL instance. No test login branch exists in application source.
Actual hosted Supabase, Google/browser sessions, provider outputs and deployment
persistence require staging checks. Existing SQLite/D1 records have not moved.
Historical project reviews remain in `docs/archive`.
