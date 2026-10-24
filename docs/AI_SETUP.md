# Activate API translations and RAG

Keep the existing Supabase/Google login configuration. Complete these steps to
activate API translations and RAG. If migration 002 is already applied, skip
step 1; credentials, indexing and the updated application deployment are separate
steps.

## 1. Apply the new schema once

For an existing project with the original schema, run only
[202610250002_ai_services.sql](../supabase/migrations/202610250002_ai_services.sql)
in Supabase SQL Editor as administrator. Do not rerun migration 001. A fresh
project needs 001 followed by 002. The new migration installs pgvector in the
`extensions` schema and creates languages, translations, vectors and private
work/budget tables. If vector is already installed elsewhere, check its schema
before applying; this migration expects `extensions.vector`.

If the existing project was initialized through the migration runner, use that
same ledger-backed workflow instead. Do not mix SQL Editor initialization with
the runner without reconciling its ledger; see [database setup](../supabase/README.md).

## 2. Configure server-only credentials

Keep `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL` and the publishable key. Add these to
the chosen local/server environment:

```dotenv
SUPABASE_SECRET_KEY=sb_secret_REPLACE_WITH_FRESH_KEY
GEMINI_API_KEY=REPLACE_WITH_KEY
GEMINI_MODEL=REPLACE_WITH_SUPPORTED_GENERATION_MODEL
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
RAG_MIN_SIMILARITY=0.25
```

Create a **fresh** secret key under Supabase **Settings → API Keys**. Revoke any
key previously exposed in chat; do not reuse it. This privileged credential stays
server-only with no `NEXT_PUBLIC_` prefix. The code uses it narrowly for public
translation/index storage and durable leases; the key itself has service-role
privileges, so protect it accordingly. Core profile/job/application CRUD still
uses each verified user's JWT and RLS.

Gemini generation needs an explicit supported `GEMINI_MODEL` in addition to its
key. The embedding model must be consistent between indexing and searches, with
768 output dimensions. Changing the embedding model requires reindexing. Sarvam
continues to use `SARVAM_API_KEY` and optional `SARVAM_MODEL=saaras:v3` for speech;
it does not translate interface labels.

Vercel settings take effect in a subsequent deployment. Do not commit credentials
to Git, and do not push/redeploy until that action is intended.

## 3. Load and review translations

The existing language grid calls `/api/languages`. Supabase's `app_languages`
registry controls display names, ordering, enabled state and advertised PDF
capability for English, Malayalam, Tamil, Hindi and Telugu. Code checks the speech
and locale capabilities; unsupported rows are ignored.

The client loads approved `entry`, `workspace` and `resume` bundles through
`/api/translations`. GET never calls Gemini. A same-origin POST can generate a
missing bundle, validate exact keys/placeholders, and persist it. Cache identity
includes locale, source hash, prompt version and model. No resume answers or
arbitrary caller-supplied text enter UI translation prompts.

English uses source text. Bundled translations remain the immediate fallback
when services are absent, busy, invalid or unavailable; a successful cache bundle
replaces those labels without redesigning the page. Native-speaker review is
still needed. Employer descriptions and evidence quotes retain their wording.

## 4. Backfill existing vacancies explicitly

With the local environment configured, run this only when ready to make real
database/provider requests:

```powershell
pnpm ai:index
```

The tool pages through active, unexpired public vacancies, skips current
version/model/hash rows, and reports indexed/existing/deferred/stale/failed
totals. It never reads private profiles or applications. It stops on a provider
or storage failure rather than repeatedly spending calls. Retry after fixing the
cause/backoff. Nothing runs automatically at build time.

New and reopened jobs attempt bounded indexing after a successful user-authorized
save. Failed/deferred indexing does not roll back that save. SQL invalidates old
vectors on job changes; the manual tool repairs missing rows. Query requests
embed only the question and never regenerate the vacancy collection.

## 5. Check retrieval and answers

Signed-in matching uses pgvector cosine retrieval with current-job, version,
model, location, category and type filters. `/api/rag` retrieves up to five real
vacancies, asks Gemini for a concise answer, and checks each cited job/version,
field and exact quote. It rereads current jobs after generation. Missing setup,
provider failure or rejected citations returns explicit keyword/source-fact
fallbacks. Sample jobs are excluded from assistant evidence.

The saved candidate's experience/skills may be prompt context under their session;
these private details are never indexed and are not proof of employer facts.
Quote checks establish provenance, not correctness, verified skills or eligibility.
Try labelled relevant/unrelated questions, filters, empty results, quota failures,
and a job closed during answer generation. Real provider quality and hosted
behavior need separate verification.

## Work limits

| Workflow               | Daily UTC claim ceiling      |
| ---------------------- | ---------------------------- |
| Translation generation | 30 bundles globally          |
| Public job indexing    | 1,000 jobs globally          |
| RAG query/answer       | 30 claims per signed-in user |

A query embedding and its generated answer each consume a claim, so an uncached
full semantic answer normally uses two. Bundles may use multiple provider
requests. Failed attempts count; failed work backs off 15 minutes and abandoned
leases can be retried after expiry. These are durable workflow limits, not a
complete application-wide spend cap. Provider billing/quota controls remain
separate; older extraction/speech routes have their own behavior.
