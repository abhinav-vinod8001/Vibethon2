# JobSathi

A Malayalam-first hiring prototype: describe experience, confirm a profile, discover a vacancy, apply deliberately and let an employer review the submitted snapshot.

This codebase now runs on **standard Next.js and Node.js**, independently of OpenAI/Sites hosting. Platform scaffolding, Cloudflare bindings, Worker runtime, custom preview/install scripts and trusted identity headers have been removed.

## Recommended hosting

Use **Vercel + hosted libSQL + Google sign-in** for the first staging deployment. It fits the standard Next.js routes and preserves the current SQLite-compatible schema. The same app can run on a Node host such as Render or through the included Dockerfile. Use a remote database on serverless hosting; a local file there is not durable storage.

No new infrastructure has been provisioned. Real database/OAuth/AI credentials and deployment verification are the next phase. See [deployment instructions](docs/DEPLOYMENT.md).

## Start locally

Use Node 22.13+ and pnpm 11.25.0. Run from the repository root:

```sh
pnpm install --frozen-lockfile
```

Copy .env.example to .env.local. Keep the local database URL, generate NEXTAUTH_SECRET, and configure Google OAuth as described in the deployment guide. The development callback is http://localhost:3000/api/auth/callback/google.

```sh
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000. Public sample browsing works without OAuth, but saving profiles, posting and applying require a configured sign-in provider. AI features separately require Gemini/Sarvam credentials. Configuration status alone does not prove a real provider request succeeds.

## What works in source

- Candidate-confirmed profiles, employer vacancies and deliberate applications.
- Submitted profile snapshots; manual shortlist/contact and candidate withdrawal.
- Server ownership checks, vacancy versions, closure/deadline checks and duplicate prevention.
- Labelled sample vacancies that cannot receive applications.
- Keyword search, optional Gemini embeddings/extraction/grounded explanations and Sarvam transcription.
- Standard Google OAuth configuration and encrypted session cookies; no header-based identity shortcut.
- Local or hosted libSQL connection, repeatable checked migrations and a database health endpoint.
- Resume PDF download from the saved profile, with English/Malayalam fonts, automatic pages and empty sections omitted.

Skills are self-reported and quote containment is not proof of semantic correctness. Most UI text remains English. External job feeds, messaging, applicant ranking and automatic hiring decisions are not implemented. Real OAuth/provider flows need staging checks; account configuration is required.

## Download a resume

Sign in, create or edit your profile, and save it after confirmation. Open **My profile → Download resume PDF**. The download includes only the saved profile; unsaved form edits are excluded. An authenticated request to GET /api/profile/resume exports only the requesting user's record, regardless of query parameters. No generated PDF is retained on the server and no AI call is made.

The bundled Noto Sans Malayalam font supports English/Malayalam text. Long profiles continue onto additional pages. The source font license and documented fontkit compatibility patch are included. This is a readable resume export, not a validated claim of compatibility with every applicant tracking system.

## Structure

```text
src/app/                 Next.js pages, API routes and global styles
src/features/workspace/  Candidate/employer UI, client API helper, loading hook and feature types
src/components/          Shared dialog and form field
src/domain/              Pure matching, types, validation and samples
src/server/              Verified identity, database, HTTP and AI adapters
src/db/                  Drizzle schema
drizzle/                 Versioned SQL migrations
scripts/                 Migration runner
tests/                   Matching and built-server integration checks
public/                  Browser assets
docs/                    Architecture, deployment, roadmap and preserved history
evaluation/              Actual verification results and manual gates
.github/workflows/       CI checks
```

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration
pnpm test:standalone
```

Verified locally: TypeScript, lint, 6 matching tests, production build and 70 integration assertions pass in both standard and standalone servers. Integration starts the built Next.js server using a temporary database and signed synthetic sessions. It exercises actual routes without external OAuth or AI calls. [Verification results](evaluation/results.md) distinguish automated evidence from deployment/browser/provider checks.

## Next work

1. **Staging:** configure host/database/Google OAuth, apply migrations, validate two-account hiring and real AI calls. Plan old D1 data/identity migration if records must be retained.
2. **Profile reliability:** cancel stale AI/recording responses; add short guided Malayalam onboarding and split remaining workspace concerns.
3. **Retrieval:** bound embedding requests, measure against keyword results and strengthen unknown/no-match presentation.
4. **Original features:** validate the new resume download in staging, then consider one clearly attributed external feed.
5. **Public launch:** deletion/retention, backups, provider spend limits, monitoring and accessibility.

The [next-phase plan](docs/NEXT_STEPS.md) includes two-person ownership and a two-hour staging schedule. [Architecture](docs/ARCHITECTURE.md) explains current boundaries; [deployment](docs/DEPLOYMENT.md) covers environment setup and Vercel/Node/Docker paths.

The original GitHub resume-builder review and requested older VoxPop summary are preserved under docs/archive. They describe historical versions, not the current hosting architecture. No live hosted records were moved; D1 identity mapping needs an explicit migration. Recovery snapshots of the pre-cleanup source and generated platform caches were saved outside this workspace.
