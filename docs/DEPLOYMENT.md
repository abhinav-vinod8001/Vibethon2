# Deployment and environment setup

Use Vercel for Next.js and Supabase for PostgreSQL and Google authentication.
Node/Docker hosting works with the same remote Supabase project. No local database
file or persistent app disk is needed.

## Supabase setup

1. Open the [Supabase dashboard](https://supabase.com/dashboard), create a project
   named `jobsathi-staging`, select a suitable nearby region, and save its database
   password in a password manager.
2. Open **Connect** and copy Project URL and the `sb_publishable_...` key.
   Specific keys are also listed under **Settings → API Keys**. The app deliberately
   rejects secret/admin and legacy keys.
3. Open **SQL Editor → New query**. Run
   [the initial migration](../supabase/migrations/202610250001_initial_schema.sql)
   once as administrator on the fresh project. If already applied, do not rerun.
   Table Editor should show profiles, jobs, and applications with RLS enabled.
4. Create/edit a web OAuth client in [Google Cloud Console](https://console.cloud.google.com/).
   Configure branding/audience, basic openid/email/profile scopes, and test users
   while the consent screen is in testing. Add
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback` as the authorized redirect URI.
   Copy the exact callback from Supabase's Google provider screen.
5. Under Supabase **Authentication → Sign In / Providers → Google**, enable Google
   and save the Google Client ID and Client Secret. They belong here, not in the
   app's `.env.local` or Vercel environment.
6. Under **Authentication → URL Configuration**, initially set Site URL to
   `http://localhost:3000` and add `http://localhost:3000/auth/callback` to Redirect
   URLs. For staging, set Site URL to the stable HTTPS domain and allow its
   `/auth/callback` URL too. Keep the local callback if developing against staging.

These are two different redirects: Google returns to Supabase's `/auth/v1/callback`;
Supabase then returns to the app's `/auth/callback`, which exchanges the PKCE code.
The application ignores caller-supplied redirect destinations.

References: [API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[Next.js sessions](https://supabase.com/docs/guides/auth/server-side/nextjs).

## Environment variables

Copy `.env.example` to `.env.local` for development and fill it in. Never commit
`.env.local`. In Vercel use **Project → Settings → Environment Variables** and
select the deployment environment. Redeploy after changing settings.

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Trusted application origin: `http://localhost:3000` locally; stable HTTPS staging domain on the host |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL from Connect |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key, paired with verified user sessions and RLS |
| `SUPABASE_DB_URL` | Optional CLI migration connection; use Connect → Session pooler and URL-encode the database password |
| `GEMINI_API_KEY` | Optional server-only Google AI Studio key for AI features |
| `GEMINI_MODEL` | Exact supported text model ID; required with the Gemini key for generation |
| `GEMINI_EMBEDDING_MODEL` | Embedding model; defaults to `gemini-embedding-001` |
| `SARVAM_API_KEY` | Optional server-only speech transcription credential |
| `SARVAM_MODEL` | Speech model; defaults to `saaras:v3` |

The Next.js server reads Supabase settings at runtime, including in standalone
Docker. The conventional `NEXT_PUBLIC_` names identify non-secret connection
settings; no Supabase browser SDK is currently needed because the UI uses Next.js
routes. Cookies are HTTP-only, SameSite=Lax, and Secure when APP_URL is HTTPS.
Use the same hostname as APP_URL when opening the local application.

## Optional migration runner

Choose **SQL Editor or this runner** for the initial migration, not both. With a
fresh Supabase project and `SUPABASE_DB_URL` set, run:

```powershell
pnpm db:migrate
```

It requires a TLS session-pooler PostgreSQL connection and records normalized
checksums in a private `jobsathi_migrations` schema. A transaction/advisory lock
protects migration application; unchanged migrations are skipped and changed
applied files are rejected. Do not run migrations during normal web requests.
The SQL Editor method does not create this runner's migration ledger; if you
already used the editor, skip the runner and apply later SQL changes deliberately.

Never put the database password or a Supabase admin key in a `NEXT_PUBLIC_` variable.
The web deployment does not require the migration connection or an admin key.

## Vercel staging

1. Import the GitHub repository as a staging project. Use Node 22, pnpm's lockfile,
   and the detected Next.js preset. Supabase migrations must be applied first.
2. Set APP_URL and the two Supabase connection settings, plus optional provider
   settings. Use a separate database/project for production later.
3. Add the stable staging callback to Supabase's Redirect URLs and redeploy.
4. Check `/api/health`: it should return 200 with database ready. Missing config
   or a failed database query returns 503. This is not a Google/AI health check.
5. Complete the two-account acceptance checks below before calling staging ready.

Use a stable staging domain for auth. Random preview domains need deliberate
configuration and separate data/environment settings. No infrastructure has been
provisioned by the source migration itself.

## Node and Docker

For Node use `pnpm build` then `pnpm start` with runtime environment variables.
For Docker:

```powershell
docker build -t jobsathi .
docker run --rm -p 3000:3000 --env-file .env.local jobsathi
```

Apply migrations separately before starting the container. The image includes
the standalone Next.js output, public/static assets, and traced PDF font. It does
not include environment files. Docker build/run needs its own target-host check.

## Acceptance checks

- Two real Google accounts can sign in, reload, refresh sessions, and sign out.
- Candidate confirms/saves a profile and downloads the correct PDF.
- Employer posts a job; candidate applies once; duplicate submission is rejected.
- Employer sees only their applicants; an unrelated account sees neither private
  profiles nor applications. Database policies also reject direct unauthorized API calls.
- Profile edits do not change submitted snapshots. Close/reopen changes job
  version; stale/closed/expired submissions fail. Withdrawal cannot be reversed.
- Records survive a redeploy. Check real Gemini and Sarvam requests separately;
  configured values alone do not establish provider access or output quality.

Before importing old SQLite/D1 data, back it up and map each old identity to the
correct Supabase UUID. Do not link accounts by an unverified email address.
