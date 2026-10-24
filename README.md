# JobSathi

A multilingual hiring prototype: describe your experience, confirm a profile,
discover local jobs, and apply deliberately. Employers review the profile snapshot
submitted with each application and decide whom to contact.

**Stack: Next.js 16 + Supabase PostgreSQL + Supabase Auth.** Deploy the app on
Vercel or another Node.js host. Google sign-in is configured inside Supabase.

## Start locally

Use Node.js 22 (22.13+) and pnpm 11.25.0. The package pins Node to the 22.x major
so Vercel uses the same runtime as CI and Docker.

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

Choose English, Malayalam, Tamil, Hindi, or Telugu before signing in. The choice
is remembered on this device; the language switcher remains available throughout
the workspace. Signed-out visitors start with a language grid, followed by a
compact Google sign-in card. The dashboard retains the original green/cream
styling and layout. Without Supabase settings, choose **Browse jobs first** to open a
sample-only guest workspace. Saving,
posting, and applying require sign-in. A configured but unreachable database
returns an error rather than silently substituting sample records.

Core hiring flows need only the publishable key and verified user sessions;
Row Level Security (RLS) protects profiles, jobs, and applications. The optional
AI translation cache/index writer uses a separate server-only Supabase secret
key. Google provider secrets stay in Supabase, not the application environment.

See [full deployment and key setup](docs/DEPLOYMENT.md). `.env.example` also lists
optional Gemini/Sarvam settings and a migration-only database connection.
The new AI services require [migration 002](supabase/migrations/202610250002_ai_services.sql)
and a fresh server-only `SUPABASE_SECRET_KEY`. Follow
[AI activation](docs/AI_SETUP.md) to configure the services and index existing
vacancies. Skip migration 002 if it has already been applied.

## Implemented

- Language-first onboarding in English, Malayalam, Tamil, Hindi and Telugu;
  translated candidate/employer controls, recording, validation and AI messages.
  The menu reads a database language registry through `/api/languages`.
  `/api/translations` serves versioned Gemini-generated bundles from Supabase,
  with bundled translations available when setup, provider calls or quota fail.
- Guided resume building: one question at a time, editable typing and speech on
  every question, optional skills/preferences, Back/Next, and a final review.
  Transcripts are previewed before insertion. Answers stay in memory until saved;
  closing an edited draft asks before discarding it.
- Google login through Supabase, PKCE callback, HTTP-only cookies, session refresh,
  server-verified identity, and local-session logout.
- Confirmed profiles, employer jobs, candidate applications, immutable profile
  snapshots, manual shortlist/contact updates, and candidate withdrawal.
- Database access policies, checked write functions, duplicate prevention, job
  versions, and closed/expired-job checks.
- Clearly labelled sample jobs, keyword search, optional Gemini extraction,
  persistent pgvector retrieval and source-quoted explanations, and Sarvam
  transcription. The job assistant retrieves current real vacancies before
  generating answers with checked job/version/field citations.
- Private PDF export from the saved profile, fonts for all five languages, omitted
  empty sections, and automatic page breaks. No generated PDF is stored.

Job embeddings are stored once per current job version/model/content hash;
searches embed only the question. New/reopened jobs attempt bounded indexing after
the user-authorized save. Indexing failure does not undo a successful job save;
`pnpm ai:index` is an explicit operator backfill/retry command, never a build step.
Ordinary clients cannot write vectors or translation caches. Employer-written
content and exact evidence quotes stay in their original language. Language
changes do not rewrite saved profiles. Database configuration enables/disables
and orders the five implemented language capabilities; adding an arbitrary row
does not add missing speech/font support.
Translations need native-speaker review before a public release. Skills are self-reported;
quote containment does not prove an AI interpretation is correct. External job
feeds, messaging, resume uploads, and automated hiring decisions are not included.

## Structure

```text
src/app/                 Pages, API handlers, and OAuth callback
src/proxy.ts             Supabase session refresh
src/features/workspace/  Candidate/employer interface and client helpers
src/features/language/   Language selection, localized sign-in and shared state
src/features/resume/     Guided questions, review and safe voice recording
src/i18n/                Approved UI text, language capabilities and fallback dictionaries
src/components/          Shared dialog and form fields
src/domain/              Validation, matching, shared types, sample jobs
src/server/              Supabase, auth, translations, RAG, HTTP, and PDF adapters
supabase/migrations/     PostgreSQL tables, RLS policies, and write functions
scripts/                 Checked migration runner and explicit vacancy-index backfill
tests/                   Matching, database security, and built-server checks
docs/                    Architecture, deployment, roadmap, historical archive
evaluation/              Verification evidence and remaining staging checks
```

## Checks

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:multilingual
pnpm test:database
pnpm test:translations
pnpm test:rag
pnpm test:ai-database
pnpm build
pnpm test:integration
pnpm test:ai-integration
pnpm test:standalone
pnpm test:vercel-build
```

Database tests execute the actual SQL in PGlite PostgreSQL with a simulated Auth
schema. Integration starts a built Next.js server and talks to a local simulated
Supabase Auth/PostgREST gateway backed by the same PostgreSQL policies/functions.
These checks need no cloud credentials and introduce no production auth bypass.
They do not replace a real hosted Supabase/Google browser check.

Vercel uses its deployment adapter output; local/Node/Docker builds retain
standalone output. `test:vercel-build` builds with Vercel's environment flag and a
minimal Next.js adapter to catch the Next 16.3 standalone/adapter tracing conflict.
It also checks that the resume PDF font remains in the route trace. This is a
local adapter regression check, not Vercel's complete cloud packager.

See [verification results](evaluation/results.md) for completed checks and their
limits. Local provider fixtures do not establish real translation quality,
retrieval relevance, provider quota/access, or hosted deployment success.

## Next phase

Activate migration 002 and the new AI writer only when ready, backfill existing
vacancies, then review cached translations with native speakers and evaluate
retrieval/citations against labelled questions. Test the existing language-first
onboarding, Google login, six-question resume, PDF, and two-account hiring journey
on the intended deployment. Then consider private resumable drafts and optional
education/contact sections. Provider keys belong in server environment variables.
See [two-person staging plan](docs/NEXT_STEPS.md) and
[verification results](evaluation/results.md).

Existing SQLite/D1 accounts and records are not automatically imported. Back up
the original database and map old identities to Supabase UUIDs before importing.
Historical reviews remain in `docs/archive`; earlier versions remain in Git.

<!-- Vercel sync trigger -->

