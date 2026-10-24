# Older project summary: VoxPop, World Cup Edition

Archived on 24 October 2026 before importing JobSathi_Source (1).zip.

## Purpose and architecture

The previous project was a civic incident dashboard named VoxPop: World Cup Edition, despite its jobsathi directory name. It used Python 3.10+, FastAPI, Pydantic and Uvicorn with a static HTML/CSS/JavaScript frontend. All tickets were stored in process memory and reset when the server restarted.

## Original files

- `main.py`: request validation, seeded tickets, category inference, geographic clustering, severity escalation, HTTP routes and dispatch memo generation.
- `static/index.html`: citizen complaint form, coordinate inputs, stylized Kochi incident map, operations queue and dispatch dialog.
- `static/app.js`: API calls, ticket rendering, map clicks, dispatch actions and optional browser speech recognition using en-IN.
- `static/styles.css`: responsive dark dashboard, green accents, animated critical markers and external Google Fonts.
- `requirements.txt`: fastapi>=0.115,<1.0 and uvicorn[standard]>=0.30,<1.0.
- `README.md`: installation and launch instructions: pip install -r requirements.txt, then python -m uvicorn main:app --reload.

## Features and rules

Residents submitted a phone number, complaint and coordinates, optionally dictating through browser speech recognition. Keyword rules inferred Road Hazard, Sanitation or Grid Utility, and High or Medium urgency. Reports merged into open tickets of the same category when both coordinate differences were less than 0.0007 degrees. This was an approximate bounding box rather than a measured 75-meter radius.

Merged tickets became Critical for high urgency or at least four reports. A new ticket started at High for high urgency, otherwise Moderate. A seeded Critical pothole cluster contained four reports at latitude 10.062, longitude 76.531. Tickets were sorted by report count. Dispatch generated a public-works memo and set status to DISPATCHED.

## HTTP routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | / | Dashboard |
| GET | /api/health | Health and ticket count |
| GET | /api/tickets | Public tickets and impact text |
| POST | /api/grievances/submit | Create or cluster a complaint |
| POST | /api/tickets/{ticket_id}/dispatch | Generate memo and mark dispatched |

## Observed limitations

- No database, authentication, ownership checks, phone verification or report deduplication.
- The mock/live toggle only changed a returned label; no external dispatch service was called.
- Category extraction and impact synthesis used keyword rules and templates, not an AI provider.
- The map was a CSS illustration rather than a geographic map service.
- Submitted complaint text flowed into ticket innerHTML, creating an HTML-injection risk.
- No automated test suite existed in the original source.

## Replacement and recovery

The original files were backed up to `C:/Users/SREERAG/OneDrive/Desktop/jobsathi-before-import-2026-10-24.zip` before replacement. Existing `.git` and `.agents` metadata were preserved. The ZIP's JobSathi directory was flattened into this workspace root. Old Python source, frontend assets and bytecode cache were removed. No civic data was migrated; runtime data had only existed in memory.

The imported project is a separate React/TypeScript hiring prototype with candidate profiles, employer vacancies, applications, keyword/vector matching, Cloudflare D1, Sites-managed identity and optional Gemini/Sarvam integration. It needs its own dependencies and runtime configuration; refer to its README.md. Provider quality and production readiness were not independently validated during import.
