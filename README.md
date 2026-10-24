# JobSathi

Turn spoken experience into a confirmed profile, discover local vacancies, and apply directly to employers.

This workspace contains the React/TypeScript hiring prototype imported from the supplied ZIP. The [original JobSathi](https://github.com/sreerag-47/JOB_SATHI) is a separate multilingual resume builder with a Python backend. Its guided interview, PDF generation and external search are reviewed as future improvements; they are not all included here. The previously archived VoxPop dashboard was unrelated to the original JobSathi.

## Current workflow

1. Type or record experience; review suggestions and explicitly confirm the profile.
2. Publish a vacancy from the employer workspace.
3. Discover the vacancy and inspect its details/source-linked explanation.
4. Deliberately submit a snapshot of the confirmed profile.
5. Employer reviews and manually shortlists or marks contacted; the candidate can withdraw.

Bundled sample vacancies are labelled and cannot receive applications. Candidate skills are self-reported. Source quotes support traceability, not independent verification. Employers make hiring decisions.

## Stack and capabilities

| Area | Implementation |
| --- | --- |
| UI | React/TypeScript, Next-compatible routes, Vinext runtime |
| Hosting/data | Cloudflare Workers, D1 and Drizzle migrations |
| Identity | Sites-managed ChatGPT identity; simulated local identity in development |
| Search | Keyword baseline; Gemini embeddings with exact cosine search when available |
| Explanation/extraction | Server-side Gemini adapter, schema validation and supporting quotes |
| Speech | Server-side Sarvam adapter; Malayalam/English input setting |

The interface is mostly English; an input-language option is not a fully translated Malayalam UI. No resume PDF export, external job feeds, standalone consumer auth, messaging, automatic rejection or candidate ranking is included. Provider quality and broader language support require real validation. Retrieval is bounded to a small prototype corpus, not an ANN vector index.

## Quick start

Use Node 22.13+ and pnpm 11.25.0, as declared in package.json. Run commands from this project root:

```sh
pnpm install --frozen-lockfile
npm run build
```

For a **fresh local database**, apply the initial migration once after the build creates dist/server/wrangler.json:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_nice_puma.sql
npm run dev
```

Open the URL printed by the development server. Apply migrations in order and do not replay an existing schema. Local and hosted databases are separate. The build/start/runtime scripts belong to the supplied Sites integration; preserve them. The portable development path supports this Windows checkout; the install:ci helper is intended for its managed Linux environment.

## Optional AI configuration

Configure server-side variables in ignored .dev.vars locally or the hosted runtime settings, then restart/redeploy as appropriate:

| Variable | Purpose |
| --- | --- |
| GEMINI_API_KEY | Generation and embeddings credential |
| GEMINI_MODEL | Account-accessible structured-output generation model |
| GEMINI_EMBEDDING_MODEL | Optional embedding model override |
| SARVAM_API_KEY | Speech recognition credential |
| SARVAM_MODEL | Optional speech model override |

See .env.example for names only; never bundle actual keys. Manual profile entry and keyword search are available without AI. Configured flags do not prove provider health; test real calls and record exact working models.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run test:integration
```

Integration tests require a built Worker and run with isolated D1/synthetic identities. They make no real AI calls. Verified after cleanup on Windows: 6 matching tests, TypeScript, production build and 33 Worker integration assertions passed. Real providers and browser journeys remain untested. Details are in [evaluation/results.md](evaluation/results.md).

## Work plan and review

- [Revised two-person, two-hour plan](docs/TWO_PERSON_TWO_HOUR_PLAN.md): ownership, phased schedule, stop rules and later restoration phases.
- [Original implementation review](docs/IMPLEMENTATION_COMPARISON.md): source-linked findings, comparison and prioritized improvements.
- [Detailed development notes](docs/DEVELOPMENT.md): original imported runtime/architecture documentation; root README and results log hold current cleanup/check status.
- [Cleanup manifest](docs/CLEANUP_MANIFEST.json): removed files and full recovery backup.
- [Older local-project summary](docs/archive/OLDER_PROJECT_SUMMARY.md): preserved VoxPop history.

## Layout

```text
app/          Candidate/employer workspace, API routes and domain helpers
db/           Drizzle schema
drizzle/      SQL migrations and migration metadata
lib/          Retained Worker connector context, contract and preview types
public/       Browser assets
worker/       Worker entry point
scripts/      Build, install, runtime and preview tooling
tests/        Matching and isolated Worker checks
docs/         Current plan, review, development notes and requested history
evaluation/   Actual observations and outstanding validation
```

Unused starter UI/components, hooks, vendor styles and unreferenced helpers were removed after a recovery archive was verified. Runtime contracts, hosting configuration, migrations and licenses for retained code remain. Dependencies/lockfile are retained for reproducibility; unused dependency pruning is a separate build-verified task. GitHub source was reviewed without remote changes.
