# Next steps

The implementation preserves the original green/cream UI, language grid,
compact Google sign-in and one-question resume builder. API-backed language
configuration, cached translation bundles, persistent pgvector retrieval and a
source-cited job assistant are implemented. Verify migration 002, server
credentials and indexing before checking the features on the updated deployment.
Existing login/provider setup should be retained.

## Phase 1 — activate deliberately

Follow [AI setup](AI_SETUP.md): apply migration 002 only if not already applied,
create a fresh server-only AI writer key, configure provider models, and explicitly
run `pnpm ai:index` for existing vacancies. A job save remains successful if its
indexing fails. Missing setup keeps bundled translations and keyword search
available. Push/deployment and live database changes require a separate action.

## Phase 2 — evaluate before extending

- Review all four Indic languages with native speakers, including placeholders,
  short login labels, validation messages and mobile text wrapping.
- Compare vector and keyword results for the same labelled questions: exact
  matches, paraphrases, unrelated work, empty results and location/type filters.
- Check every assistant citation against its actual job/version/field. Close a
  vacancy during an answer and confirm the stale source disappears.
- Test actual Gemini/Sarvam access, quota failures and phone microphone behavior;
  configured flags and local fixtures do not establish provider quality.
- Complete a two-account post → profile → apply → review → shortlist journey,
  plus reload, PDF export and logout, without changing the original UI.

## Two-person, two-hour activation and evaluation plan

Start this sprint only once live changes/deployment are authorized and both
people have the necessary dashboard access.

| Elapsed     | Person A: app/database                                                  | Person B: language/AI                                                                     | Checkpoint                             |
| ----------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| 0–20 min    | Back up/check schema; apply migration 002 once; set fresh server key    | Confirm provider models/credits; prepare five labelled questions and short speech samples | Configuration recorded without secrets |
| 20–40 min   | Run explicit index backfill; inspect totals; deploy the agreed revision | Open each language; generate/cache bundles; review initial labels and placeholders        | Registry/cache/index available         |
| 40–75 min   | Two-account hiring flow, saved-profile PDF and stale-job checks         | Compare retrieved jobs/citations, no-match/filter behavior and real speech                | Failures and fallback modes recorded   |
| 75–100 min  | Fix the highest-impact functional issue and integrate                   | Review translations and actual mobile navigation; verify retry/quota messages             | Critical path usable                   |
| 100–120 min | Retest affected checks and rehearse the demo                            | Record relevance/translation findings and outstanding limits                              | Reviewable demo and next-issue list    |

Timebox provider diagnosis; retain the working keyword/typing flows if access is
blocked. This is an evaluation sprint, not a promise of public-release readiness.

## Phase 3 — product and operational improvements

Prioritize private resumable drafts, optional education/contact fields with
consent, and a listen-to-question option after measuring onboarding needs. Add
operator visibility for deferred indexing, broader abuse/rate controls, deletion
and retention rules, backup/restore checks, and privacy-safe monitoring before a
public release. Review multilingual retrieval on a larger labelled corpus before
changing similarity thresholds or embedding models.

Additional languages need verified UI wording, speech capability and PDF fonts;
an extra database row alone is insufficient. Employers continue to make hiring
decisions. Automatic applications/rejections and unvalidated eligibility claims
are outside this plan.
