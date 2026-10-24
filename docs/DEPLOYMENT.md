# Deployment and configuration

## Recommended first deployment

Use **Vercel + hosted libSQL + Google sign-in** for the current application. Vercel directly supports standard Next.js; a remote database keeps data independent of serverless filesystems. This minimizes changes to the existing SQLite schema. Render or another Node host is an alternative when you need a long-running service or Docker.

This recommendation concerns implementation fit, not a guarantee of free hosting or a fixed bill. Check the selected account's limits and charges before provisioning. No infrastructure has been provisioned or deployed by this cleanup.

References: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Render Next.js web services](https://render.com/docs/deploy-nextjs-app), [libSQL TypeScript client](https://docs.turso.tech/sdk/ts/reference), [Google provider setup](https://next-auth.js.org/providers/google).

## Local setup

Use Node 22.13+ and pnpm 11.25.0. Run from the repository root:

```sh
pnpm install --frozen-lockfile
```

Copy .env.example to .env.local. For PowerShell:

```powershell
Copy-Item .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Set the generated value as NEXTAUTH_SECRET. Keep DATABASE_URL=file:.data/jobsathi.db and NEXTAUTH_URL=http://localhost:3000 locally. Configure a Google OAuth web application with callback http://localhost:3000/api/auth/callback/google and set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET. Do not use the GitHub CLI authentication credential as an application secret.

```sh
pnpm db:migrate
pnpm dev
```

The migration runner loads .env.local/.env; environment variables already supplied by the process take precedence. Never commit real environment files. Sign-in remains unavailable until OAuth credentials are configured; public sample browsing and API configuration checks do not require a user session.

## Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| DATABASE_URL | Production | Hosted libSQL connection URL, or a persistent local file on a stateful Node host |
| DATABASE_AUTH_TOKEN | Hosted database if required | Server-side database credential |
| NEXTAUTH_URL | Interactive auth | Canonical public HTTPS app URL; localhost HTTP for development |
| NEXTAUTH_SECRET | Interactive/protected auth | Strong random application session secret; keep stable across instances |
| GOOGLE_CLIENT_ID | Google sign-in | OAuth client ID |
| GOOGLE_CLIENT_SECRET | Google sign-in | OAuth client secret |
| GEMINI_API_KEY / GEMINI_MODEL | AI generation | Account-accessible structured-output model |
| GEMINI_EMBEDDING_MODEL | Optional | Embedding model override |
| SARVAM_API_KEY / SARVAM_MODEL | Speech / optional model | Speech recognition credential/model |

All variables above are server-side. Do not prefix credentials with NEXT_PUBLIC_. Separate production/staging databases and OAuth registrations. Avoid sharing a production database with preview builds.

## Vercel release

1. Create the hosted libSQL database and save its connection URL/token in deployment secrets.
2. Import the GitHub project into Vercel as a Next.js project. Use pnpm install --frozen-lockfile and pnpm build; use the default Next.js output handling.
3. Set the environment variables. Set NEXTAUTH_URL to the final HTTPS domain and register https://YOUR_DOMAIN/api/auth/callback/google in Google OAuth.
4. Apply pnpm db:migrate once in a trusted release environment using the target database credentials. Do not run migrations concurrently from every preview/deployment instance.
5. Deploy, check /api/health, then test two separate accounts through post → confirm → apply → shortlist → withdraw.
6. Validate real Gemini/Sarvam calls and record model names, failure behavior and observations.

## Node or Docker alternative

```sh
pnpm build
pnpm start
```

The standard server listens on PORT. The included Dockerfile builds Next.js standalone output and runs as an unprivileged user:

```sh
docker build -t jobsathi .
docker run --rm --env-file .env.production jobsathi node scripts/migrate.mjs
docker run --rm -p 3000:3000 --env-file .env.production jobsathi
```

Use remote database credentials in these examples. A file database instead requires a writable persistent volume mounted at the same path for migration and app containers. Terminate HTTPS at the host/reverse proxy and set the canonical NEXTAUTH_URL. Docker configuration is provided; an actual container build/run must be checked on a Docker-enabled machine.

## Existing D1 data and identities

No existing hosted records or credentials were accessed or moved. Export and back up D1 before migration. Create a fresh target schema, import compatible application data and explicitly map old ChatGPT owner/candidate IDs to the new authenticated identities. Do not silently match accounts by email or reuse synthetic test IDs. Verify row counts, snapshots, ownership and rollback on staging first. The migration runner is not a D1 export/import tool or an existing-schema baselining tool.

## Release checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration
pnpm test:standalone
```

Integration starts a real built Next.js server with a temporary local libSQL database and signed synthetic sessions. It verifies hiring behavior and rejects forged/expired sessions without making OAuth or AI provider requests. Hosted database connectivity, real Google login, deployment routing and provider quality require staging verification.

## Resume PDF packaging

PDF export uses bundled font assets and PDFKit; it does not require a remote rendering service or an AI key. Keep assets/fonts and patches in the source checkout. next.config.ts explicitly traces fonts into the resume route; the Docker dependency stage copies patches before the frozen install. The standalone test exercises the same authenticated PDF endpoint from the packaged server, confirming the renderer and font are available. An actual Docker build/run and staging browser download still need environment-level verification.
