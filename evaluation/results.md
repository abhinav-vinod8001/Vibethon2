# Validation and evaluation log

Updated 24 October 2026. Use actual observations only. Blank or not-run entries are not passes.

## Observed in this checkout after original-repository review

| Check | Result | Evidence/limit |
| --- | --- | --- |
| Imported ZIP integrity | PASS during import | 134 imported files matched the supplied ZIP before documentation cleanup |
| Matching tests | PASS, 6/6 | node --experimental-strip-types --test tests/matching.test.ts; Node 22.19.0 |
| Source review | Completed | Original GitHub main at 0e4c8ebbd8f099996b92c366f1b203ee9fbf0c8e compared with current app; static review only |
| Cleanup integrity | PASS | 71 removed paths checked against recovery ZIP; Markdown links verified; product app/ code unchanged |
| Dependency install | PASS | pnpm install --frozen-lockfile; pnpm 11.25.0, Node 22.19.0 |
| TypeScript | PASS | npm run typecheck after cleanup |
| Production build | PASS | npm run build; Vinext/Vite Worker build completed on Windows |
| Worker integration | PASS, 33 assertions | npm run test:integration; built route handlers, isolated D1, distinct synthetic identities; no external AI |
| Real Gemini generation | Not tested | Credentials/provider runtime not inspected |
| Real Gemini embeddings | Not tested | No semantic success or quality claim |
| Real Sarvam speech | Not tested | No Malayalam quality claim |
| Browser hiring loop and hosted access | Not tested | No deployment inspected in this task |

## Session details — fill during the two-hour sprint

- Person A / Person B:
- Start / finish:
- Demo URL or local environment:
- Source revision and deployed revision:
- Node / package-manager version:
- Generation model actually used:
- Embedding model actually used:
- Speech model actually used:
- Access arrangement: single-account demonstration / separately authorized accounts:

## Manual gates

| Scenario | Expected result | Actual observation | Status |
| --- | --- | --- | --- |
| Post → confirmed profile → apply → shortlist | Stored transaction survives reload | — | Not run |
| Change saved profile after applying | Submitted snapshot unchanged | — | Not run |
| Close vacancy | Hidden from discovery; new application blocked | — | Not run |
| Duplicate / unauthorized action | Appropriate rejection; no private data leak | — | Not run |
| Malayalam recording with name and number | Editable transcript; inspect correctness | — | Not run |
| Denied microphone or stopped recording | Manual editing works; microphone released | — | Not run |
| Payments task extraction | Supported skill; no invented software expertise | — | Not run |
| Provider error | Explicit error/fallback; edits retained | — | Not run |
| Related experience retrieval | Actual semantic mode if successful; filters enforced | — | Not run |
| Missing accommodation or qualification | Explicit unknown; no fabrication | — | Not run |
| Grounded answer | Quote exists and meaning is manually supported | — | Not run |
| Vacancy containing instructions | Treat as data; no changed permissions or behavior | — | Not run |

## Five-query smoke evaluation

Use the same five synthetic vacancies and filters for keyword and semantic runs. Person A labels acceptable jobs before seeing B's results. Use one near miss and one no-acceptable-result query. If semantic retrieval falls back, mark semantic not tested for that row. Keep candidate information synthetic.

| Query / profile | Reviewer-labelled acceptable job IDs | Keyword top 3 | Semantic top 3 | Actual mode / notes |
| --- | --- | --- | --- | --- |
| 1 | — | — | — | Not run |
| 2 | — | — | — | Not run |
| 3 | — | — | — | Not run |
| 4 | — | — | — | Not run |
| 5: no acceptable match | None | — | — | Not run |

Keyword: relevant result in top three for __ / __ queries with an acceptable job. Semantic: __ / __ comparable completed queries. Report false suggestions on the no-match case separately. This is a small smoke evaluation, not hiring accuracy, fairness or proof of general retrieval quality. Record per-case request time if measured; do not invent aggregate latency.

## Final verification and handoff

| Check | Environment / revision | Result / failure |
| --- | --- | --- |
| Matching tests | Windows, Node 22.19.0, current cleanup | PASS, 6/6 |
| TypeScript | Windows, current cleanup | PASS |
| Build | Windows, current cleanup | PASS |
| Worker integration | Windows, current cleanup | PASS, 33 assertions |
| Real provider gates | Not exercised | Not tested |
| Demo access and rehearsal | Not exercised | Not tested |

Known limitations / unresolved blockers:

- Fill with actual findings. Provider and browser checks listed as not tested above remain outstanding until recorded otherwise.
