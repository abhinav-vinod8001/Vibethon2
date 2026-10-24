# Architecture

JobSathi now uses the standard Next.js Node runtime. It has no OpenAI/Sites hosting dependency, Cloudflare binding, Worker entry point, custom preview protocol or platform-provided identity headers.

## Source boundaries

| Directory | Responsibility |
| --- | --- |
| src/app | Next.js pages, CSS and HTTP route entry points |
| src/features/workspace | Candidate/employer workspace behavior and views |
| src/components | Shared accessible dialog and form field primitives |
| src/domain | Shared types, sample data, validation and pure matching logic |
| src/server | Authentication, parameterized database access, HTTP helpers and AI providers |
| src/db | Drizzle schema used to generate migrations |
| drizzle | Ordered SQL migrations and schema metadata |
| scripts | Platform-independent migration runner |
| tests | Pure matching tests and built-server integration tests |

## Request flow

Browser → Next.js route → verified session cookie → domain validation → parameterized SQL → response.

Gemini and Sarvam run only behind server routes. Credentials come from process environment variables. Keyword search and manual profile entry remain usable without AI providers. Configuration flags indicate credentials are present, not provider health.

## Authentication

NextAuth.js handles Google OAuth and encrypted JWT session cookies. Protected routes derive identity from a cryptographically verified cookie. Client-supplied identity headers are ignored. There is no mock-production login or development bypass. Stable owner IDs use the provider and provider account ID, not an unverified email address.

Google credentials and NEXTAUTH_SECRET must be configured before interactive sign-in works. Integration tests issue synthetic signed sessions with an ephemeral test-only secret; they do not add an authentication bypass to application code. Real Google redirect/callback and logout still require browser verification with configured credentials.

## Data

The database adapter uses @libsql/client with a SQLite-compatible schema. Development defaults to file:.data/jobsathi.db. A deployment must explicitly supply DATABASE_URL. Use a hosted libSQL endpoint for Vercel/serverless, or a persistent volume with a single Node service. An ephemeral local file is not durable production storage.

Routes retain parameterized SQL and atomic application insertion, ownership checks, vacancy versions, confirmed profile snapshots and closed/expired-job exclusion. The adapter is intentionally small so switching deployment platforms does not change route behavior. A future PostgreSQL migration would require deliberate SQL/schema changes; this is not a universal multi-database adapter.

Migrations are explicit release operations. The runner applies ordered SQL files transactionally, records checksums and skips unchanged applied migrations. It rejects modified applied migrations. Application requests do not create or alter tables.

## Preserved product limits

Retrieval still uses a bounded set of vacancies and exact cosine comparisons, without an ANN index. Most UI text remains English. Skills remain self-reported. Quote containment is a traceability check, not proof of semantic correctness. Resume PDF export, external feeds, messaging and automated hiring decisions are not implemented.

## Historical records

docs/archive contains the original repository review and the requested summary of the unrelated VoxPop app previously in this folder. Those documents describe historical versions. Current source paths and setup are defined here and in DEPLOYMENT.md.
