# Next phases

The platform cleanup replaces Sites/Vinext/Workers/D1 bindings with standard Next.js, configurable Google sessions and a local-or-hosted libSQL connection. This makes the application independent of the former hosting runtime. It does not provision a host, migrate existing accounts/data or prove AI quality.

## Phase 1 — configure and prove a staging deployment (next)

| Owner A: application and deployment | Owner B: integrations and evidence |
| --- | --- |
| Create staging host/database; configure production environment and Google OAuth callback; run migrations; verify health and two-account access | Configure Gemini generation/embeddings and Sarvam; perform real Malayalam recordings and record successful models/failures |
| Complete employer posting, profile confirmation, application, snapshot review, manual shortlist and withdrawal | Inspect skill evidence, unrelated retrieval and missing-benefit answers; verify typing/keyword fallbacks |
| If old data matters, back up/export D1 and agree an explicit identity migration | Compare counts/snapshots/ownership after staged import; do not assume old/new identity IDs match |

**Gate:** two actual accounts complete the hiring journey on the chosen host; database records survive redeployment; logout works; unauthorized access fails; real provider results and limitations are recorded. This is the next need, before adding product features.

## Two-person, two-hour staging sprint

| Elapsed | Person A | Person B | Checkpoint |
| --- | --- | --- | --- |
| 0–15 min | Configure staging database, host and OAuth URL | Verify provider keys/model access; prepare a short Malayalam sample | Environment accessible; no secret committed |
| 15–40 min | Apply migrations, deploy, check health and login/logout | Test real speech, extraction and embeddings separately | Actual provider outcomes recorded |
| 40–75 min | Two-account post → confirm → apply → shortlist; verify reload and withdrawal | Review sources, unknown accommodation, unrelated query, filters and fallback | Core flow proven; defects assigned |
| 75–100 min | Fix the highest-impact deployment/transaction issue; integrate | Five labelled queries against the same vacancies; inspect unsupported skill inference | Evidence log filled; no new feature scope |
| 100–120 min | Final checks and rehearse three-minute journey | Retest real calls and describe exact limitations | Stable staging demo and rollback point |

If provider access blocks progress, timebox diagnosis and keep the conventional hiring flow working; do not call keyword fallback semantic AI. If staging/login is blocked after 30 minutes, both solve that shared blocker and reduce evaluation breadth. No resume/PDF or major UI refactor belongs in this two-hour sprint.

## Phase 2 — reliable profile and Malayalam onboarding

- Protect asynchronous extraction/transcription with cancellation or request IDs so old responses cannot overwrite edited/cancelled drafts.
- Split the large workspace by candidate/employer/profile concerns; add focused hooks and feature types without changing API contracts.
- Add a short optional guided profile path with reviewed Malayalam labels, editable answers and useful follow-up questions.
- Define a shared language-capability table; distinguish translated UI, speech support and prompt audio.
- Test keyboard navigation, mobile recording, denied microphone, stop/cancel, slow requests and preserved edits.

**Gate:** the critical path is usable in Malayalam, stale requests cannot corrupt drafts, and confirmation remains explicit.

## Phase 3 — evidence and retrieval reliability

- Bound embedding concurrency; index/reindex records with observable success/failure states and consistent model versions.
- Evaluate semantic and keyword top-three results over the same reviewer-labelled corpus, including no-match and near-miss examples.
- Improve current-vacancy versus candidate-evidence presentation; do not imply that a quoted substring establishes correctness.
- Add provider rate/spend limits and handle timeout/quota errors without losing edits.

**Gate:** measured retrieval observations, honest empty/fallback states, supported explanations and controlled provider usage.

## Phase 4 — restore selected original features

Confirmed-profile resume PDF export is now implemented with English/Malayalam font embedding, owner-only access, empty-section omission and multi-page layout. Validate an actual signed-in browser download on staging next. Additional templates or contact fields require explicit product decisions; do not silently expose OAuth account details. Then consider one external job source with provenance, fetched time, expiry and separate external-apply behavior. Retain clearly labelled samples; never substitute synthetic vacancies as real openings.

**Gate:** PDF rendering/text extraction and authorization work; external listings are distinguishable from internal applications. No unmeasured ATS-compatibility claims.

## Phase 5 — public-release readiness

Implement data deletion/retention, account recovery/linking policy, backups/restores, privacy-safe logs, user-visible contact consent, abuse controls and deployment monitoring. Review OAuth provider suitability for the intended community; add another provider or email/phone onboarding only with a deliberate account-linking policy. Add database indexes/pagination when measurements justify them.

**Gate:** production access/data lifecycle and restore procedures are tested, known limits are documented, and CI covers the deployed code. Business verification, messaging, pricing and growth claims remain separate product decisions.

## Avoid during these phases

Automatic applications/rejections, candidate ranking, additional languages without validation, a second framework migration, many simultaneous external providers and a vector-database migration without measured need. Human employers continue to decide, skills remain self-reported and the product makes no validated fairness/employment-outcome claim.
