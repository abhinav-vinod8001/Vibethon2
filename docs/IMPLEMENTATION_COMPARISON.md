# Original JobSathi review and comparison

Reviewed 24 October 2026 against [sreerag-47/JOB_SATHI](https://github.com/sreerag-47/JOB_SATHI), main snapshot `0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e`, and this workspace. GitHub code was statically reviewed, not installed or executed.

## Project history corrected

The **original GitHub JobSathi** is a multilingual voice-to-resume application. The **current imported JobSathi** is a separate implementation of a durable hiring platform. **VoxPop**, previously occupying this local folder, is an unrelated civic dashboard, not the original JobSathi. Its requested historical summary remains in `docs/archive/`.

The earlier comparison covered VoxPop and the ZIP because the original repository had not been supplied. This document replaces that comparison. GitHub source was not overwritten, committed or deployed during this task.

## Feature comparison

| Area | Original GitHub implementation | Current implementation | Recommendation |
| --- | --- | --- | --- |
| Journey | 20-question resume interview → generated profile → external jobs | Confirmed profile → posted vacancy → application → manual shortlist | Keep hiring transaction; restore selected guidance |
| Stack | React/JSX, Vite, Python/FastAPI | React/TypeScript, Vinext/Cloudflare Workers | Keep one runtime during the sprint |
| Speech | Local ai4bharat Indic Conformer through PyTorch/Transformers | Server-side Sarvam adapter | Validate Malayalam first; self-hosted ASR is a later choice |
| Languages | Many frontend choices/bundles; backend transcription allowlist has 12 entries | Malayalam/English input setting; mostly English UI | Separate translation, prompt-audio and ASR capabilities |
| Guidance | 20 questions, skip, progress and prerecorded prompts | Experience box and up to two generated follow-ups | Restore a short optional guided path |
| PDF | ReportLab generation and download endpoint; reviewed UI connection incomplete | Not implemented | Restore one reviewed template after core gates pass |
| Storage | In-memory interview sessions; completed JSON/PDF files on disk | D1 profiles, jobs and immutable submitted snapshots | Retain durable storage; add retention/deletion |
| Employer | Mock login and in-memory jobs/applicants | Server-side ownership and durable hiring records | Keep current server implementation |
| Discovery | Adzuna/Jooble/SerpAPI, weighted substrings, synthetic fallback | Internal postings, labelled samples, keyword/vector retrieval | Real local jobs first; one external feed later |
| Grounding | Prompted extraction and cleanup | Schema validation, supporting quotes and current-record explanations | Retain checks; review meaning, not just literal quotes |
| Tests | None found in reviewed tree | Matching tests and isolated Worker integration suite | Record actual results rather than README claims |

## Findings in the original code

1. **Language choices disagree with ASR support.** Frontend choices include Bodo and Dogri, which the backend allowlist rejects. Use one capability table and test every advertised language. Start with Malayalam/English. Evidence: [frontend choices](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/frontend/src/App.jsx), [backend allowlist](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/backend/app/main.py#L89).

2. **Employer functionality is mocked.** Fixed client-side demo credentials, module arrays and fabricated statistics do not provide authentication or persistence. Keep the current D1-backed workflow. Evidence: [mock employer service](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/frontend/src/services/mockEmployerApi.js).

3. **No-results behavior can mislead.** When providers return nothing, original search substitutes synthetic jobs with familiar company names. When no result clears its relevance threshold, it returns all with a base score of 5. Use explicit source/sample flags and an honest empty state. Evidence: [search fallback](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/backend/app/job_search.py#L478).

4. **Resume download needs ownership and UI integration.** Timestamp/name files are served without an authenticated owner check. Use opaque artifact IDs, owner authorization, path containment and retention/deletion rules. The reviewed result card has restart/search actions but no implemented PDF-download action. Evidence: [storage/download handler](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/backend/app/main.py#L848), [result card](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/frontend/src/components/ResumeResultCard.jsx). This is static review, not a demonstrated traversal exploit.

5. **Runtime work needs bounds.** Async handlers invoke synchronous inference/provider/search work; external searches are sequential and the reviewed speech handler has no configured upload-size ceiling. Add limits, timeouts, bounded inference concurrency and privacy-safe logging. Backend startup also requires a generation key. Evidence: [backend](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/backend/app/main.py), [sequential searches](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/backend/app/job_search.py#L503).

6. **Setup docs and audio paths need reconciliation.** README references setup/start scripts and tests absent from the reviewed tree. Audio is mounted from `app/audio_files`, while another handler targets `app/audio`. The tree contains 486 MP3s, about 50.9 MiB. These are product prompt assets, not automatically junk: retain deliberately supported languages with attribution/licensing checked; archive before reducing release bundles. Evidence: [README](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/README.md), [audio handler](https://github.com/sreerag-47/JOB_SATHI/blob/0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e/backend/app/main.py#L931).

## Improvements for the current application

| Priority | Improvement | Acceptance check |
| --- | --- | --- |
| P0 | Prove build and hiring loop | Fresh vacancy → confirmed profile → submitted snapshot → shortlist survives reload; ownership tests pass |
| P0 | Validate real providers | Successful speech/generation/embeddings with actual models recorded; configured booleans are insufficient |
| P1 | Reject stale extraction/transcription | Request IDs/cancellation prevent results applying after draft edits, cancellation or newer requests |
| P1 | Bound embedding requests and clarify unrelated results | Replace large uncached Promise.all bursts with controlled concurrency/cache strategy; no relevance guarantee for unrelated semantic input |
| P1 | Short guided Malayalam onboarding | Reviewed translated critical path, editable answers, useful follow-ups and explicit confirmation |
| P1 before public access | Data lifecycle and provider controls | Deletion/retention, rate/spend limits and privacy-safe logs verified |
| P2 | Reviewed resume export | Confirmed fields only; unknowns omitted; Malayalam fonts, preview and authorized download |
| P2 | Split app/jobsathi.tsx | Smaller candidate/employer/profile modules after deadline |
| P2 | One external feed | Source URL, fetched time, expiry and external apply behavior separate from internal applications |

These are recommendations, not product features implemented during cleanup. See the revised plan for two-hour scope and later phases.

## Cleanup

Removed unused starter components/hooks, their utilities/wrappers, unimported vendor styles, unused Drizzle runtime helper and superseded reference document. Removed obsolete lint exemptions and example exclusion. Retained runtime scripts, Worker connector context/contract/preview types, hosting settings, migrations, tests and the retained Sites plugin license.

[CLEANUP_MANIFEST.json](CLEANUP_MANIFEST.json) lists every removed path and recovery ZIP. Dependencies/lockfile remain for reproducibility; package pruning needs separate verification. Tooling now has project name `jobsathi`, named check scripts and Windows-safe Worker test paths. [Results](../evaluation/results.md) distinguish actual checks from outstanding provider/browser work.
