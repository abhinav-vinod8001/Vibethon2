# Revised JobSathi plan: two people, two hours

Updated 24 October 2026 after reviewing the original GitHub JobSathi. This replaces the earlier plan. Two hours means 120 elapsed minutes, four combined person-hours.

## Goal and foundation

Use the current D1-backed hiring application for the demo. Preserve the original idea: help people express informal experience through Malayalam voice and simple guidance. Restore selected original interactions incrementally; migrating the Python ASR/PDF server into Workers is outside this sprint.

By minute 120: a newly posted vacancy receives a confirmed application and an employer manually shortlists it. Show real speech, supported extraction, semantic retrieval and a grounded explanation wherever actual providers succeed. Disclose unavailable steps and use manual entry/labelled keyword fallback. That fallback is a partial AI outcome.

## Owners

| Person | Responsibility | File boundary |
| --- | --- | --- |
| A: app and delivery | Environment/access, hiring flow, UI blockers, database, final checks and demo | Sole editor of app/jobsathi.tsx, app/globals.css, manifests/runtime config; profile/jobs/applications/bootstrap routes; db/schema.ts, migrations, Worker integration tests |
| B: AI and evidence | Real provider calls, transcription/extraction, retrieval, grounding and evaluation | app/lib/ai.ts, app/lib/matching.ts; ai/match/transcribe routes; matching tests; evaluation/results.md |

B sends bounded UI requests to A. Integrate at minutes 35, 65 and 85 with changed files, verification and exact remaining failures. Before staging, inspect `git rev-parse --show-toplevel`: this workspace previously resolved to a parent repository. Use an agreed project-only checkout; do not stage unrelated files.

## Phases

| Time | Person A | Person B | Exit gate |
| --- | --- | --- | --- |
| 0–10: baseline | Choose verified hosted/local build, intended audience and rollback. Start dependency setup if needed. | Check credentials/model access; prepare short Malayalam shop-work example and five queries. | Known working path and owners. No architecture migration. |
| 10–35: components | Typecheck/build; prepare D1 if needed; save typed profile and post synthetic vacancy; verify reload. | Test actual speech, extraction and embedding calls separately. Inspect name/number accuracy and exact quotes. | Persistent profile/vacancy; actual provider outcomes logged. |
| 35–65: transaction | Apply, review submitted snapshot, shortlist and reload. Exercise closure/duplicate/ownership checks. | Retrieve with paraphrased experience; open sources; ask about unstated accommodation; test labelled fallback. | Complete real hiring loop; AI result or exact failure per step. |
| 65–85: focused fixes | Fix highest-impact observed blocker. If none, add three short optional Malayalam guidance prompts in the existing experience flow; no schema change. Label acceptable jobs before seeing rankings. | Compare keyword/semantic top three on the same five small cases and filters. Include unrelated/no-acceptable-result input. | Observed results recorded; at most one bounded UX improvement. |
| 85–105: freeze | Integrate, freeze features, run final checks and verify chosen demo access/build. | Matching tests, real-provider retest, mic denial/stop, edit preservation and results log. | No new features after minute 85; preserve working build after minute 95. |
| 105–120: rehearse | Rehearse three-minute demo twice; capture backup recording if feasible. | Narrate evidence/limits and verify synthetic or consented demo data. | Source/build identity, fallback and limitations ready. |

If local setup is blocked at minute 30, switch only to an actually accessible hosted build. If neither environment works, both spend ten minutes on the shared blocker and reduce evaluation/polish. Timebox each blocked provider to ten extra minutes; A continues conventional hiring. If hiring still fails at minute 65, drop all optional guidance work.

## Acceptance checklist

- [ ] Fresh real database vacancy persists; bundled samples remain clearly distinct.
- [ ] Profile is reviewed/confirmed; consent precedes application.
- [ ] Submitted snapshot stays unchanged after later profile edits; manual shortlist persists.
- [ ] Closed vacancies, duplicate submissions and unauthorized actions are handled correctly.
- [ ] Real Malayalam output is editable; microphone stop/denial/failure preserves typing.
- [ ] Collecting payments does not become invented billing-software expertise.
- [ ] Actual keyword/semantic mode is labelled; source meaning is manually checked.
- [ ] Missing accommodation/qualifications remain unknown.
- [ ] Async results cannot overwrite newer drafts or apply after cancellation; prioritize any observed failure over optional polish.
- [ ] Matching/typecheck/build/Worker results and five-query observations recorded, including failures or unrun checks.
- [ ] Actual demo audience checked; single-account role switching described honestly.

## Setup and checks

Run from the project root with Node 22.13+ and the pnpm version in package.json:

```sh
pnpm install --frozen-lockfile
npm run typecheck
npm test
npm run build
npm run test:integration
```

Integration requires built dist/server output and uses isolated D1/synthetic identities, not real providers. After building, initialize a fresh local demo database only once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_nice_puma.sql
npm run dev
```

Apply migrations once/in order. Local and hosted data differ. Configure server-side GEMINI_API_KEY, GEMINI_MODEL and SARVAM_API_KEY; optional model overrides are documented in .env.example. Use ignored .dev.vars locally and restart/redeploy as appropriate. Configuration flags alone do not prove successful calls.

## Three-minute demo

| Time | Show |
| --- | --- |
| 0:00–0:25 | New employer vacancy |
| 0:25–1:05 | Malayalam recording/correction, or disclosed typing fallback |
| 1:05–1:35 | Supported suggestions and profile confirmation |
| 1:35–2:10 | Actual retrieval mode, explanation and expanded source |
| 2:10–2:40 | Application snapshot and manual shortlist |
| 2:40–3:00 | Observed counts, sample size and exact limitations |

Explain the evolution: original multilingual resume interview; current durable hiring workflow; resume export/wider localization still planned.

## Follow-on phases beyond two hours

These are separate deliverables, not included in the sprint promise.

| Phase | Person A | Person B | Completion gate |
| --- | --- | --- | --- |
| 1. Guided Malayalam onboarding | Optional short steps, reviewed labels, progress, audio controls and draft recovery | Cancellation/stale-result protection, shared language capability contract and translated errors | Full critical path works in Malayalam; enabled languages match backend support |
| 2. Reviewed resume export | Confirmed-field preview/download and Malayalam-capable layout | Typed export contract; ownership/opaque IDs if stored; omit unknown fields | PDF renders/extracts correctly; authorized download; no invented facts |
| 3. Reliable discovery | Internal applications distinct from external link-outs; honest empty states | Bounded embedding concurrency/cache; one external feed with provenance, expiry, timeout and deduplication | No synthetic listings presented as real; measured retrieval results |
| 4. Public-release readiness | Intended user access, deletion UI, mobile/keyboard checks and component split | Retention/deletion, rate/spend limits, privacy-safe logs, CI and authorization regressions | Deployment trust boundary/data lifecycle verified; claims match evidence |

Do not restore mock employer credentials, synthetic relevance scores, unsupported language claims or personal filenames. Keep self-hosted ASR/multiple external sources as later choices requiring measured need. Reuse behavior through typed contracts rather than merging both apps wholesale.
