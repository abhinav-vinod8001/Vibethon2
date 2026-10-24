# Architecture

JobSathi runs on standard Next.js 16/Node.js with Supabase PostgreSQL and Supabase
Auth. Gemini and Sarvam run behind server routes. The app has no Sites/Workers/D1
runtime or trusted identity-header dependency.

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
types by server adapters. Empty deadlines are stored as NULL. The app never uses
a Supabase admin key; even server reads carry the user's JWT and respect RLS.
Migrations run separately, through SQL Editor or the checked PostgreSQL runner.

## Source boundaries

| Directory | Responsibility |
| --- | --- |
| src/app | Pages, route handlers, OAuth callback |
| src/features/workspace | Candidate/employer interface, forms, client requests |
| src/components | Shared dialog and form fields |
| src/domain | Validation, matching, samples and product types |
| src/server/supabase | Connection config, cookie client and database types |
| src/server | Identity, database operations, HTTP, AI and PDF |
| supabase/migrations | Versioned PostgreSQL schema, policies and RPCs |
| tests | Matching, PostgreSQL security and built-server integration |

## AI and PDF

Keyword/manual flows need no AI keys. Semantic search generates vectors on demand
and performs exact cosine comparisons over a bounded vacancy set. Public RPCs
cannot supply trusted vectors. Durable indexing, request bounds and pgvector are
future work. Quote containment is a traceability check, not proof of correctness.

`GET /api/profile/resume` verifies the user, loads their confirmed saved profile
under RLS, and renders an in-memory PDF. A query-string user ID cannot change the
owner. PDFs have private/no-store headers and are not retained. Noto Malayalam
fonts and the documented fontkit patch remain bundled in standalone output.

## Verification boundaries

PGlite tests execute the real migration with simulated Auth identities. Built
Next.js integration tests use a local Auth/PostgREST protocol fixture backed by
that PostgreSQL instance. No test login branch exists in application source.
Actual hosted Supabase, Google/browser sessions, provider outputs and deployment
persistence require staging checks. Existing SQLite/D1 records have not moved.
Historical project reviews remain in `docs/archive`.
