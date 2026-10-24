# Verification results — portable Next.js migration

Updated 25 October 2026. These observations apply to the current local migration branch, codex/portable-hosting. The previous Sites/Worker results are historical and do not establish deployment validation for this version.

## Automated checks observed

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Frozen dependency install | PASS | pnpm 11.25.0, Node 22.19.0, updated lockfile; explicit build-script allowlist |
| TypeScript | PASS | pnpm typecheck and production build type checking |
| Lint | PASS | ESLint checked all source paths explicitly, plus scripts/tests/config |
| Matching tests | PASS, 6/6 | pnpm test; filters/deadlines/keyword ranking/Malayalam tokens/cosine |
| Standard Next.js production build | PASS | pnpm build; Next.js 16.3.4; standalone output |
| Built-server integration | PASS, 70 assertions | pnpm test:integration; actual Next.js HTTP server, temporary libSQL/SQLite database, encrypted synthetic sessions |
| Standalone server integration | PASS, 70 assertions | pnpm test:standalone; verifies packaged renderer and font work outside the source runtime |
| PDF visual/text QA | PASS | Synthetic English/Malayalam profiles render as one page each; long profile spans three pages; every page visually inspected, fonts embedded, empty skills omitted and all 65 experience lines retained |
| Documentation and cleanup | PASS | Local Markdown links checked; old runtime/scaffolding paths absent; direct packages reduced 44 to 18 |
| CI and Docker configuration | Added, not executed remotely | GitHub Actions workflow and Dockerfile authored; container build/run not tested here |

Integration coverage includes repeated migrations, public page, auth provider discovery/CSRF/session/logout, profile confirmation, owner visibility, immutable application snapshot, duplicate/stale-version/closed-vacancy rejection, manual shortlist, withdrawal, cross-origin writes, keyword fallback, unconfigured AI behavior and invalid/expired session rejection. Former platform identity headers cannot authenticate a request. No production requests or external OAuth/AI calls were made by this suite.

## Still needs real staging validation

| Check | Status | Required observation |
| --- | --- | --- |
| Hosted database connectivity/persistence | Not tested | Records survive deployment/restart and remain isolated from preview data |
| Google OAuth browser round trip | Not tested | Configured callback, sign-in, reload and sign-out for two real accounts |
| Real Malayalam speech | Not tested | Editable accurate-enough transcript; names/numbers manually inspected |
| Gemini generation/embeddings | Not tested | Actual working model names, supported skill evidence and returned semantic mode |
| Browser/mobile/keyboard flow | Not tested | Post → confirm → apply → review → shortlist → withdraw; microphone denial/stop/cancel |
| D1 record/identity migration | Not performed | Backups, explicit ID mapping, row counts, snapshots, ownership and rollback verified |
| Docker build/run and remote CI | Not tested | Real container/CI checks pass on target environment |

## Five-query retrieval smoke log

Use the same labelled vacancies, filters and candidate examples for keyword and semantic runs. A reviewer labels acceptable jobs before looking at results. Include a no-acceptable-result example; do not count keyword fallback as semantic success.

| Query / profile | Acceptable job IDs | Keyword top 3 | Semantic top 3 | Actual mode / notes |
| --- | --- | --- | --- | --- |
| 1 | — | — | — | Not run |
| 2 | — | — | — | Not run |
| 3 | — | — | — | Not run |
| 4 | — | — | — | Not run |
| 5: no acceptable match | None | — | — | Not run |

Record observed counts, sample size, failures and request times only. This smoke evaluation does not establish hiring accuracy, fairness or general multilingual quality.

## Recovery and scope

Pre-migration tracked source was archived outside the workspace as jobsathi-before-portable-hosting-2026-10-24.zip. Old generated platform output/cache directories were moved to sibling jobsathi-platform-cache-2026-10-24. No live credentials, hosted records or provider accounts were migrated. Current code is local on the migration branch; the earlier published baseline remains in remote history.

## Resume feature verification

The expanded suite checks unauthenticated and missing-profile errors, caller-only export despite a different userId query, PDF content type/attachment, private no-store response, English/Malayalam/long-profile generation and existing hiring/auth behavior. Synthetic QA PDFs were rendered through Poppler and inspected; pypdf confirmed the correct profile owner, omitted empty section, retained final line and embedded fonts. Malayalam is visually rendered with shaping; machine text extraction may return reordered combining characters, so no general ATS/parser guarantee is claimed. Real OAuth/browser download on staging remains outstanding.
