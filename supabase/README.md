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
4. Open **Table Editor**. You should see `profiles`, `jobs`, and `applications`.

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

| RPC | Arguments |
| --- | --- |
| `save_profile` | `p_profile` (current camelCase profile JSON), `p_confirmed: true` |
| `create_job` | `p_job` (current camelCase job JSON) |
| `set_job_status` | `p_job_id` (UUID), `p_status` (`active` or `closed`) |
| `submit_application` | `p_job_id`, `p_version` (integer), `p_confirmed: true` |
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

Direct API writes are intentionally denied. New APIs must use the RPCs instead of
a secret/admin key that bypasses RLS. Account/job deletion needs a separate data
retention workflow: foreign keys restrict deletion of users/jobs with hiring
records. Existing identities require an explicit mapping before data import.

Embedding columns preserve JSON arrays for future server-generated values. The
public create-job RPC does not accept untrusted embedding vectors. Trusted
indexing and a possible pgvector migration remain next-phase work. Semantic
matching generates vectors on demand. PDFs continue
to be generated from saved profiles; no PDF storage table or bucket is required.

Local verification: 44 checks passed using PGlite PostgreSQL with simulated
Supabase Auth. Checks covered migration execution, RLS, denied direct writes,
RPC identity/ownership, validation, snapshots, duplicate applications, stale/
closed/expired jobs, and withdrawal rules. Hosted Supabase login and concurrent
transaction behavior have not been tested by this local verification.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[database function security](https://supabase.com/docs/guides/database/functions).
