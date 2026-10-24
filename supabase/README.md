# Supabase database setup

This folder defines the database used by the Supabase-integrated Next.js app.
Configure the project URL, publishable key, Google provider and application return
URLs as described in [deployment setup](../docs/DEPLOYMENT.md).

## Run the initial SQL

1. Create a fresh Supabase staging project.
2. Open **SQL Editor → New query** in its dashboard.
3. Paste the complete contents of
   `migrations/202610250001_initial_schema.sql` and click **Run** as the project
   administrator. It runs in a transaction and is intended to run once.
4. For API translations and persistent retrieval, apply
   [202610250002_ai_services.sql](migrations/202610250002_ai_services.sql) next.
   Existing projects that already applied 001 need only 002. This update has not
   applied either migration to the hosted project.
5. Open **Table Editor**. Core tables are `profiles`, `jobs`, and `applications`;
   migration 002 adds `app_languages`, `ui_translations`, and `job_embeddings`.

Supabase supplies the database, `auth.users`, and authentication functions. Do not
create a separate passwords table. Profiles are saved after explicit confirmation;
Google sign-in alone does not create an incomplete business profile.

If these application tables or `jobsathi_private` already exist, the migration
fails instead of replacing them. It does not delete or import any existing data.

Check table security after running:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'jobs', 'applications')
order by tablename;
```

All three rows should have `rowsecurity = true`. The administrator SQL Editor can
bypass RLS; use signed-in test accounts when checking actual application access.

## API contract

Use a Supabase user session and publishable key. Read tables under RLS; call these
RPCs for writes. Anonymous clients cannot call the write RPCs. The functions use
an empty search path, verified `auth.uid()` identity, and explicit permission
checks because they run as `SECURITY DEFINER`.

| RPC                      | Arguments                                                                   |
| ------------------------ | --------------------------------------------------------------------------- |
| `save_profile`           | `p_profile` (current camelCase profile JSON), `p_confirmed: true`           |
| `create_job`             | `p_job` (current camelCase job JSON)                                        |
| `set_job_status`         | `p_job_id` (UUID), `p_status` (`active` or `closed`)                        |
| `submit_application`     | `p_job_id`, `p_version` (integer), `p_confirmed: true`                      |
| `set_application_status` | `p_application_id`, `p_status` (`shortlisted`, `contacted`, or `withdrawn`) |

Each RPC returns one JSON object containing the saved database row with snake_case
column names. The server adapter maps these fields to the existing frontend types.
Empty deadlines become SQL `NULL`; timestamps are `timestamptz`; user IDs are
Supabase UUIDs; application snapshots are native JSON objects with camelCase keys.
The database creates snapshots from the saved profile, not from caller-supplied
application data. A unique constraint also rejects concurrent duplicates.

Profiles are visible only to their owners. Active, unexpired jobs are public;
owners and applicants can also read their related closed/expired jobs. Employers
read applicant snapshots for their own jobs, not a candidate's live profile.
Only candidates can withdraw; only job owners can shortlist/contact. Withdrawn
applications cannot be changed. Users retain both candidate and employer actions,
as in the current application; there is no invented admin or role system.

Direct user API writes are intentionally denied. New core hiring APIs must use
the checked RPCs, not the privileged AI writer. Account/job deletion needs a
separate retention workflow: foreign keys restrict deletion of users/jobs with
hiring records. Existing identities need explicit mapping before data import.

## API translations and vector retrieval

Migration 002 expects pgvector in the `extensions` schema and creates it there
when absent. If it is already installed, inspect before applying:

```sql
select e.extname, n.nspname as extension_schema
from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where e.extname='vector';
```

If the result names another schema, resolve that deployment precondition
deliberately first; this migration does not move existing extensions.

`app_languages` seeds English, Malayalam, Tamil, Hindi and Telugu. Normal clients
read enabled languages and their published translation bundles under RLS;
they cannot mutate language configuration, translation caches or vectors.
Additional rows must match implemented speech/font/locale capabilities.

`job_embeddings` stores only public job content at 768 dimensions with an HNSW
cosine index. Its job version, model and content hash prevent stale reuse. Job
changes invalidate old vectors. The authenticated `match_job_embeddings` RPC
accepts a JSON numeric query vector and optional filters; it checks identity,
dimension, finite/nonzero values, active status, expiry and current version. It
returns job ID, similarity and version; it grants no direct access to vector rows.

Only `service_role` can call `store_job_embedding`, `claim_ai_work` and
`finish_ai_work`. The server's optional fresh `SUPABASE_SECRET_KEY` is used
narrowly for public cache/index writes and those leases, never user CRUD. Private
lease/usage tables have no client access. Daily UTC ceilings are 30 translation
bundle claims, 1,000 indexing claims and 30 RAG claims per user; query embedding
and answer generation each claim separately. Failed work counts and backs off
15 minutes. These bounds do not cover all legacy AI/speech routes or guarantee a
monetary cap.

Run `pnpm ai:index` explicitly to backfill/retry existing vacancies once schema
and credentials are ready; it is not part of build/deployment. New/reopened jobs
attempt indexing after saving; provider/index failure leaves the job saved.
The original JSON embedding columns are legacy-compatible and are not the new
trusted index. Candidate profiles/applications and query vectors are never put
in `job_embeddings`. PDFs remain generated from saved profiles with no storage
table or bucket. See [activation and fallback behavior](../docs/AI_SETUP.md).

Local database tests execute real migrations with PGlite PostgreSQL and simulated
Supabase Auth, including actual pgvector retrieval in the AI suite. They cover
permissions, vectors, stale/closed/expired filtering, leases, backoff and quotas.
See [verification evidence](../evaluation/results.md) for completed checks.
Local tests do not establish hosted login, provider quality or multi-instance
production behavior.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[database function security](https://supabase.com/docs/guides/database/functions).
