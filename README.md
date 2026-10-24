# JobSathi

A Malayalam-first hiring prototype: describe your experience, confirm a profile,
discover local jobs, and apply deliberately. Employers review the profile snapshot
submitted with each application and decide whom to contact.

**Stack: Next.js 16 + Supabase PostgreSQL + Supabase Auth.** Deploy the app on
Vercel or another Node.js host. Google sign-in is configured inside Supabase.

## Start locally

Use Node.js 22.13+ and pnpm 11.25.0.

```powershell
pnpm install --frozen-lockfile
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Fill in these values in `.env.local` (do not overwrite an existing populated file):

```dotenv
APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR-KEY
```

1. Create a Supabase project and copy the URL/publishable key from **Connect**.
2. In **SQL Editor**, run
   [the initial database script](supabase/migrations/202610250001_initial_schema.sql)
   once on a fresh project. If you already ran that script, skip this step.
3. Enable **Authentication → Sign In / Providers → Google**. Put your Google
   Client ID/Secret there. Google's authorized redirect URI is the Supabase
   callback shown in that screen: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
4. In Supabase **Authentication → URL Configuration**, set Site URL to
   `http://localhost:3000` and allow `http://localhost:3000/auth/callback`.
5. Run `pnpm dev` and open [localhost:3000](http://localhost:3000).

Without Supabase settings, the app opens a sample-only guest workspace. Saving,
posting, and applying require sign-in. A configured but unreachable database
returns an error rather than silently substituting sample records.

No Turso token, NextAuth secret, Supabase secret/admin key, or Google secret in
the app environment is required. Only the publishable key is accepted. Sessions
and Row Level Security (RLS) control which records each user can access.

See [full deployment and key setup](docs/DEPLOYMENT.md). `.env.example` also lists
optional Gemini/Sarvam settings and a migration-only database connection.

## Implemented

- Google login through Supabase, PKCE callback, HTTP-only cookies, session refresh,
  server-verified identity, and local-session logout.
- Confirmed profiles, employer jobs, candidate applications, immutable profile
  snapshots, manual shortlist/contact updates, and candidate withdrawal.
- Database access policies, checked write functions, duplicate prevention, job
  versions, and closed/expired-job checks.
- Clearly labelled sample jobs, keyword search, optional Gemini extraction,
  semantic matching and source-quoted explanations, and Sarvam transcription.
- Private PDF export from the saved profile, English/Malayalam fonts, omitted
  empty sections, and automatic page breaks. No generated PDF is stored.

Job embeddings are generated on demand during semantic search. Durable embedding
caching/indexing remains next-phase work; public write functions do not accept
caller-supplied vectors. Most UI text is still English. Skills are self-reported;
quote containment does not prove an AI interpretation is correct. External job
feeds, messaging, resume uploads, and automated hiring decisions are not included.

## Structure

```text
src/app/                 Pages, API handlers, and OAuth callback
src/proxy.ts             Supabase session refresh
src/features/workspace/  Candidate/employer interface and client helpers
src/components/          Shared dialog and form fields
src/domain/              Validation, matching, shared types, sample jobs
src/server/              Supabase, auth, database, AI, HTTP, and PDF adapters
supabase/migrations/     PostgreSQL tables, RLS policies, and write functions
scripts/                 Optional checked PostgreSQL migration runner
tests/                   Matching, database security, and built-server checks
docs/                    Architecture, deployment, roadmap, historical archive
evaluation/              Verification evidence and remaining staging checks
```

## Checks

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:database
pnpm build
pnpm test:integration
pnpm test:standalone
```

Database tests execute the actual SQL in PGlite PostgreSQL with a simulated Auth
schema. Integration starts a built Next.js server and talks to a local simulated
Supabase Auth/PostgREST gateway backed by the same PostgreSQL policies/functions.
These checks need no cloud credentials and introduce no production auth bypass.
They do not replace a real hosted Supabase/Google browser check.

Locally verified: type checking, lint, production build, 6 matching tests,
44 database checks, and 96 assertions in each built-server mode.

## Next phase

Configure the staging project, deploy to Vercel, and verify sign-in, refresh,
logout, two-account hiring, PDF downloads, and database persistence. Then validate
real Gemini/Sarvam calls, bound embedding usage, and improve Malayalam onboarding.
See [two-person staging plan](docs/NEXT_STEPS.md) and
[verification results](evaluation/results.md).

Existing SQLite/D1 accounts and records are not automatically imported. Back up
the original database and map old identities to Supabase UUIDs before importing.
Historical reviews remain in `docs/archive`; earlier versions remain in Git.
