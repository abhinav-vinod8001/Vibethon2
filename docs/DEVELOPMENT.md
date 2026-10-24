# JobSathi

A two-sided employment prototype for Malayalam-speaking jobseekers and local employers.

## Working hiring loop

1. Create and explicitly confirm a candidate profile.
2. Switch to the employer workspace and publish a vacancy.
3. Find the vacancy in job discovery and submit a profile snapshot.
4. Review applications from the vacancy owner's workspace.
5. Manually shortlist or mark contacted; candidates can withdraw.

The same authenticated person can use both workspaces to demonstrate the loop. Authorization is checked on the server for every private read and mutation. Sample vacancies are illustrative, cannot receive applications, and are not inserted as real employer postings.

## Current implementation and limits

- Next.js App Router-compatible React UI, hosted using the supplied Vinext/Cloudflare Workers runtime.
- Durable Cloudflare D1 records and schema migrations. This first hosted build uses D1 rather than the previously proposed Supabase backend. It does **not** claim pgvector or Supabase Auth integration.
- Sites-managed ChatGPT authentication. This is a prototype access mechanism, not a standalone consumer authentication system.
- Keyword search works without external AI credentials.
- Real provider adapters exist for Gemini generation/embeddings and Sarvam speech recognition. They require configured credentials; no responses, provider metrics or semantic rankings are simulated.
- Vector retrieval uses exact cosine search over a small bounded set of vacancies, with vectors stored in D1. There is no approximate nearest-neighbour index or scaling claim. An embedding value is not an eligibility score.
- Confirmed evidence and skills are self-reported, not independently verified.
- Generated source references are checked for valid source fields and literal quote containment. This does not establish semantic correctness or eliminate hallucinations.
- This version does not include résumé PDF export, messaging, business verification, live external job feeds, automatic rejection or automated hiring decisions.

## AI pipeline

`voice/text → editable experience → supported skill suggestions → candidate confirmation → active vacancy retrieval → current-record grounding → source-linked explanation → deliberate application`

Job posting and applications continue to work without AI. Embeddings are generated at publication when possible. Existing records can be embedded on demand. Changing embedding models causes re-embedding; vectors from different models are not deliberately mixed. Exact current vacancy records are fetched again for explanations. Closing a vacancy excludes it from discovery and blocks new applications.

The retrieval endpoint applies explicit location/category/type filters and active/deadline rules, then retrieves semantically if configured. A provider failure falls back to a labelled keyword baseline. There is currently a 200-active-vacancy prototype retrieval limit and 100-record workspace limit.

The RAG endpoint uses only the selected vacancy and the requesting candidate's saved profile, or an application snapshot for an authorized employer. The generation context omits candidate names and demographic fields. Retrieved text is treated as untrusted data. Unknown information must remain unknown. No applicant ranking is implemented.

## Runtime settings

Configure these in the Site runtime environment settings and redeploy. Never put real keys in source or a browser bundle.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-only Gemini credential |
| `GEMINI_MODEL` | An available generation model supporting structured JSON through generateContent |
| `GEMINI_EMBEDDING_MODEL` | Optional, defaults to `gemini-embedding-001` |
| `SARVAM_API_KEY` | Server-only Sarvam credential |
| `SARVAM_MODEL` | Optional, defaults to `saaras:v3` |

Provider API compatibility and model access must be verified with real requests after configuration. Speech is limited to short recordings; provider failures preserve manual editing. No key has been bundled with this project.

## Source map

- `app/jobsathi.tsx`: responsive jobseeker and employer workspaces.
- `app/api/bootstrap`: current vacancies and authorized workspace records.
- `app/api/profile`: candidate-confirmed profile upsert.
- `app/api/jobs`: authenticated posting and owner-only closure/reopening.
- `app/api/applications`: atomic application submission and authorized status updates.
- `app/api/match`: filtered semantic retrieval with explicit keyword fallback.
- `app/api/ai`: evidence extraction, vacancy explanations and employer summaries.
- `app/api/transcribe`: short audio transcription proxy.
- `app/lib/ai.ts`: server-only provider adapters and prompt guardrails.
- `app/lib/matching.ts`: filtering and baseline/vector similarity utilities.
- `db/schema.ts`, `drizzle/`: durable schema and versioned migrations.
- `tests/`: matching and HTTP integration checks.

## Development

Node 22.13+ and the package manager recorded in `package.json` are required. Install dependencies, then use `npm run dev`. This repository follows the supplied Sites runtime conventions; preserve `scripts/`, `worker/`, and the Vite integration.

Run `npm run db:generate` after schema changes. Build to produce `dist/server/wrangler.json`, then apply pending local migrations using the documented Wrangler D1 command. Production migrations are applied by Sites during publication. Local and hosted data are separate.

Checks:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-strip-types --test tests/matching.test.ts
```

After building, run `node --import ./scripts/sites-env.mjs tests/worker-integration.mjs`. This executes the actual built route handlers in an isolated Worker with a disposable D1 database and synthetic identities. It makes no production requests and does not call external AI services.

## Hackathon validation still required

Once credentials are connected: test real Malayalam recordings, check extracted claims and citations, compare top-three retrieval results against a keyword baseline on independently reviewed examples, and record real latency/error rates. No AI accuracy, multilingual quality, employment-outcome, fairness or business-adoption claims have been validated yet.
