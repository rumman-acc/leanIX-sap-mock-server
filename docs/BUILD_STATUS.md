# LeanIX Mock Server — Build Status

> **Ground rule:** This file is the single source of truth for build progress. Update it after every meaningful milestone (file group added, phase completed, test run, blocker hit). Any new conversation/session picking up this work MUST read this file first before touching code.

Last updated: 2026-08-25 — Phases 1-3 complete and live-verified, Phase 4 mostly done (Admin UI + perf pass intentionally skipped, see below)

---

## 0. Environment Facts (discovered, not assumptions)

- Docker is **NOT installed** in this dev environment (stale PATH entry only, no `docker` binary, no `Program Files\Docker`). Docker Compose files are still written per spec for portability/CI, but cannot be executed locally right now.
- **PostgreSQL**: switched to a managed **Neon** cloud instance (2026-08-25, per user instruction to use cloud instances instead of Docker) — `neondb` on a `-pooler` (PgBouncer transaction-mode) endpoint in `us-east-2`. `DATABASE_URL` in the gitignored `.env` includes `&pgbouncer=true` per Prisma's guidance for PgBouncer transaction pooling. `.env.mock`/`.env.example` stay generic templates — never the real credential. A native PostgreSQL 18 (`localhost:5432`) was used earlier in this session and is no longer the active database; see the perf note below for why the switch to a real remote DB mattered.
- **Redis**: managed Redis Cloud instance provided by the user (2026-08-25), reachable over TCP (verified). `REDIS_URL` is set in the gitignored local `.env` only — **never** put the real credential in `.env.mock` or `.env.example` (those stay as generic `redis://localhost:6379/0` templates). `MOCK_RATE_LIMIT_ENABLED=true` now that Redis is live.
- See [REDIS_SETUP.md](./REDIS_SETUP.md) for background.
- Node.js v24.16.0 / npm 11.13.0 available locally (spec targets Node 20 LTS; engines field pinned to `>=20`, works fine on 24).

## 1. Decisions / Ambiguity Resolutions

| # | Ambiguity | Resolution |
|---|-----------|------------|
| 1 | Docker unavailable locally | Write full docker/docker-compose.yml + Dockerfiles per spec (for later/CI use), but run services natively (Postgres) or against managed cloud (Redis) for local dev + tests in this environment. |
| 2 | No local Redis | Build against `ioredis` + `REDIS_URL` env var; connected to managed Redis Cloud instance user provided. Rate limiter live-verified; BullMQ (Phase 2) still pending implementation. |
| 3 | GraphQL SDL (Appendix A) declares a `type Subscription` for fact-sheet subscribers, which collides with GraphQL's auto-detected root `Subscription` operation type when no explicit `schema {}` block is present | Added an explicit `schema { query: Query mutation: Mutation }` block at the top of `leanix.graphql` so `Subscription` stays a plain object type, not a root type. |
| 4 | Section 7.2.1's example query uses `... on Application` inline fragment (implying FactSheet subtypes/interfaces), but Appendix A's canonical schema defines `FactSheet` as one concrete type with no interface | Followed Appendix A literally (canonical contract per spec instructions) — no per-type FactSheet subtypes/interfaces implemented. Type-specific attributes (e.g. Application's functionalSuitability) are reachable via `attributes: [AttributeValue!]!` instead. |
| 5 | Meta model section 11 only fully specifies `Application`'s fields; the other 8 types are only named | Every type gets baseline attributes (name*, description, externalId, lifecycle); Application additionally gets functionalSuitability/technicalSuitability/businessCriticality. Allowed-value enums for those three fields aren't specified in the spec either — picked reasonable LeanIX-consistent values (documented in `packages/shared/src/constants/default-meta-model.ts`). |
| 6 | Completion formula (`filled_mandatory / total_mandatory * 100`) taken literally means a fresh fact sheet is already 100% complete, since `name` is the only mandatory field in our meta model | Implemented exactly as specified; this is a known quirk of the simplified formula, not a bug. Seed data hardcodes `completion: 25` for a couple of sample fact sheets purely for cosmetic demo variety (not derived from the real calculation). |

| 3 | Prisma's default interactive-transaction timeout (5s) assumed local-DB latency | Discovered a **real bug** once pointed at Neon: `createFactSheet`/`archiveFactSheet`/`reviveFactSheet`/`updateFactSheet`/LDIF completion-recalc transactions each do several sequential round trips, which reliably exceeded 5s over real network latency ("Transaction already closed" errors). Fixed by adding a shared `INTERACTIVE_TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 }` (`apps/api/src/common/prisma/transaction-options.ts`) to every `$transaction()` call. This is a legitimate fix regardless of which Postgres instance is used — it was just invisible against near-zero-latency local Postgres. |
| 4 | e2e tests assumed local-DB latency too | Bumped `jest-e2e.config.js` `testTimeout` 30s→60s, set `maxWorkers: 1` (parallel Nest apps opening simultaneous fresh connections was transiently rejected by the pooler), and gave the 5-mutation lifecycle test an explicit 120s timeout. All 26 tests (17 unit + 9 e2e) pass against Neon, just slower (~166s e2e run vs ~10s against local Postgres — pure network RTT, not a functional issue). |

_(add more rows as they come up)_

## 2. Phase Progress

### Phase 1 — Core — DONE, live-verified
- [x] Repo scaffold (package.json workspaces, tsconfig, .env files)
- [x] Prisma schema + migration (against native Postgres, db `leanix_mock`, role `leanix`)
- [x] Seed script (`packages/prisma/seed.ts`) — workspace, users, 9 fact sheet types, 5 relation types, sample Applications/ITComponents/BusinessCapability/Provider, relations, tags, subscriptions
- [x] Mock OAuth token endpoint `POST /services/mtm/v1/oauth2/token` — verified: valid dev- creds issue JWT, invalid creds return `{error:"invalid_client"}` 401
- [x] JWT auth guard + RBAC (`LeanIxAuthGuard`, `RolesGuard`) — verified: unauthenticated GraphQL request returns `UNAUTHENTICATED` in `extensions.code`; unit tests cover VIEWER read-allowed/write-forbidden
- [x] GraphQL endpoint at `/services/pathfinder/v1/graphql` + introspection — verified live
- [x] Fact Sheet CRUD (create/read/update/archive/revive/delete) — verified live end-to-end incl. duplicate externalId rejection and delete-only-from-trash rule
- [x] Relay pagination (cursor = base64 id) — verified live
- [x] Meta model (9 fact sheet types + Application fields + 5 relation types) — verified live via `allFactSheetTypes`
- [x] Trash bin + 90-day retention (`TrashBinEntry`) + hourly cleanup scheduler (`@nestjs/schedule`, gated by `MOCK_AUTO_DELETE_ENABLED`)
- [x] Rate limiting (Redis sliding window via sorted sets) — **live-verified against the managed Redis Cloud instance**: `X-RateLimit-*` headers observed on real responses
- [x] Error handling — GraphQL `extensions.code` and REST `{error, error_description}` shape both verified live
- [x] Unit tests — 15 passing (`fact-sheet.service`, `fact-sheet-patch.service`, `roles.guard`, LDIF validators)
- [x] E2E tests — `test/e2e/graphql.e2e-spec.ts`, boots full Nest app against real Postgres/Redis: 5/5 passing (oauth invalid-client, unauthenticated GraphQL, pagination envelope, full create/read/update/archive/revive lifecycle, introspection). Fixed a real bug found here: `RedisModule` had no shutdown hook so `ioredis` kept the process alive after `app.close()` — added a small `OnModuleDestroy` lifecycle provider that calls `client.disconnect()`.

**Ambiguity/ext beyond spec:** added an `IntegrationConfiguration` Prisma model (not in spec's Appendix D) to persist `POST /services/integration-api/v1/configurations` payloads for Phase 2 — spec section 15 requires the endpoint but Appendix D didn't model it.

### Phase 2 — Integration — DONE, live-verified
- [x] Integration API: `configurations` (POST/GET), `synchronizationRuns` (inline + `/withUrlInput`), `synchronizationRuns/{id}` status, `synchronizationRuns/{id}/logs` (extra endpoint, not in spec, for debugging row-level sync logs)
- [x] LDIF validation (`packages/shared/src/utils/validators.ts`, reused by REST layer) — verified live: missing headers / bad type → `INVALID_LDIF`
- [x] LDIF processing partial/full (`integration/ldif/ldif.processor.ts`) — verified live end-to-end with Appendix B.2-style payload (relations included)
- [x] Two-pass relation resolution: pass 1 creates/updates fact sheets and builds sourceRecordId→factSheetId map; pass 2 wires up `rel*` fields using that map (falls back to existing `SyncMapping` for cross-run relation targets)
- [x] Sync run lifecycle CREATED→RUNNING→FINISHED/FAILED — verified live (invalid fact sheet type in a batch correctly sets `FAILED` with `errorCount`, other valid items still processed)
- [x] Sync logs with row-level INFO/WARNING/ERROR detail — verified live
- [x] SHA-256 sync mapping / change detection (`SyncMapping.syncHash`, skips a partial-mode item whose normalized source data hasn't changed)
- [x] Relations CRUD via GraphQL patches (add/replace/remove using relation type + relation instance id) — implemented in `fact-sheet-patch.service.ts`
- [x] Tags (add/remove via patch, plus on create) — implemented
- [x] Subscriptions (on create) — implemented
- [x] Webhook registration/management REST API (`POST/GET/DELETE /services/webhook/v1/webhooks`)
- [x] Webhook dispatch via BullMQ + HMAC-SHA256 signature — **live-verified**: registered a real local receiver, triggered `createFactSheet`, confirmed `X-LeanIX-Event`/`X-LeanIX-Delivery`/`X-LeanIX-Signature` headers and independently recomputed the HMAC to confirm an exact byte-for-byte match
- [x] Webhook retry schedule (0/5s/25s/2m/10m/1h, max 10 attempts, 50s timeout) — implemented as self-managed BullMQ delayed re-enqueue (not BullMQ's built-in backoff, to match the exact spec schedule); found and fixed an off-by-one bug in `webhookRetryDelayMs` via unit test before it shipped
- [x] Tests — 17 unit tests, 9 e2e tests (incl. full LDIF-to-fact-sheet flow and webhook delivery w/ signature verification), all passing

**Known simplification (documented, not a gap in required behavior):** LDIF processing doesn't manage `tags`/`subscriptions` (no example in the spec's LDIF payloads includes them) — only native fields, custom attributes, and relations. Sync-run background processing uses a plain async promise (not a BullMQ job) since spec only *suggests* BullMQ "where appropriate"; webhook delivery — where retry/backoff genuinely matters — does use BullMQ.

### Phase 3 — MCP — DONE, live-verified
- [x] MCP server scaffold (`apps/mcp`, `@modelcontextprotocol/sdk` v1.30, stdio transport)
- [x] All 8 tools implemented and live-verified via a real MCP `Client`+`StdioClientTransport` smoke test (spawned the actual server subprocess, called `tools/list` and each tool): `search_fact_sheets`, `get_fact_sheet` (incl. not-found → `isError: true`), `get_relations`, `create_fact_sheet`, `update_fact_sheet`, `get_meta_model`, `get_reports`, `explain_architecture`
- [x] `workspace-summary` MCP resource (`leanix://workspace`) — bonus, not required by spec, gives per-type fact sheet counts
- [x] Shared auth w/ REST/GraphQL — `LeanIxClient` does its own OAuth `client_credentials` exchange against the same `/services/mtm/v1/oauth2/token` endpoint and caches the JWT, so MCP tools ride the exact same auth path as any other consumer (per spec 13.3)

**Real bug found and fixed here:** `zod`'s `z.enum([...])` in a tool's `inputSchema` triggered `TS2589: Type instantiation is excessively deep and possibly infinite` against `@modelcontextprotocol/sdk` v1.30's generic inference (on `search_fact_sheets`'s `status` field and `update_fact_sheet`'s patch `op` field). Fixed by using `z.string()` with a `.describe()` of the allowed values instead — GraphQL still validates the actual enum value server-side, so no runtime behavior is lost, just compile-time literal-union narrowing on that one field.

**Scope decision:** `explain_architecture` returns structured dependency-graph JSON (root fact sheet + direct relations + optional second-hop relations), not AI-generated prose — the MCP server has no LLM of its own to call; the natural-language "explanation" is expected to come from whichever model is calling this tool. `get_reports` returns a small static list of report *definitions* the mock can compute (count-by-type, completion overview, trash-bin summary) since the spec doesn't define LeanIX's real reporting engine or any concrete report schema to replicate.

### Phase 4 — Polish — mostly done
- [ ] Admin UI — **skipped**. Spec marks it "if practical"; given everything else required, prioritized the API surface, tests, and docs instead. GraphQL Playground (below) covers interactive exploration.
- [x] GraphQL Playground/GraphiQL enabled at `/services/pathfinder/v1/graphql` — live-verified (`curl -H "Accept: text/html"` returns the Apollo Sandbox landing page HTML)
- [x] Swagger/OpenAPI UI for the REST surface (auth/Integration API/Webhooks) at `/api-docs` (`@nestjs/swagger`, DTO classes in `apps/api/src/rest/dto/`) — added on request (2026-08-25) since GraphQL Playground only covers the GraphQL half; live-verified `/api-docs` returns 200 and `/api-docs-json` lists all 8 REST routes
- [x] Full test suite pass — 17 unit + 9 e2e, all green against real Postgres + managed Redis
- [x] Documentation — `README.md` (full walkthrough incl. curl examples for every surface), `docs/API_REFERENCE.md`, `docs/MIGRATION_GUIDE.md`
- [x] Sample data seed scripts — `packages/prisma/seed.ts` (deterministic ids), `scripts/setup.sh`, `scripts/seed-workspace.sh`
- [x] `docker/docker-compose.yml` + `docker/Dockerfile.api` + `docker/init-scripts/` + `Makefile` written per spec Appendix E/F — **not run end-to-end** (no Docker in this dev environment); schema/migrations/seed are identical to what *was* live-tested against native Postgres, so the only untested part is the container plumbing itself
- [ ] Performance pass — not pursued; no performance issues observed at mock-data scale, and correctness/coverage was the priority given the scope of this task

**Design note (documented, not a gap):** REST inputs (`IntegrationConfigurationInput`, `LdifUrlInput`, `WebhookConfig`) are validated with hand-written checks in their services rather than `class-validator`-decorated DTO classes, since their shapes are inherently dynamic/JSON-heavy (LDIF `data` is arbitrary key-value data by design). LDIF structural validation itself goes through a single shared, tested validator (`packages/shared/src/utils/validators.ts`) used by both the REST layer and unit tests.

## 3. What Actually Works Right Now (verified by running commands, not assumed)

All of the following were exercised live against the running server (native Postgres + managed Redis Cloud), not just unit-tested:

- OAuth token issuance (valid + invalid credentials)
- GraphQL: introspection, `allFactSheets` pagination, `allFactSheetTypes`, `search`, `factSheet(id)`
- Fact sheet lifecycle: create → read → update (patch) → archive → revive → permanent delete (rejected outside trash bin, then succeeds once archived)
- Duplicate `externalId` rejection within a type
- Rate-limit headers on real responses (`X-RateLimit-*`), backed by the real Redis Cloud instance
- LDIF sync run: multi-item batch with relations (Appendix B.2 style), partial failure handling (one bad fact sheet type → run `FAILED` with per-row logs, other items still processed and persisted), relation resolution via in-batch source-id map
- Webhook registration → real HTTP delivery → HMAC-SHA256 signature independently recomputed and matched byte-for-byte
- Webhook retry durability: confirmed a queued retry survived an API process restart (found while testing, not planned) and self-healed once the webhook was deleted
- MCP server: spawned as a real subprocess via `StdioClientTransport`, `tools/list` returned all 8 tools, called `search_fact_sheets`, `get_meta_model`, `create_fact_sheet`, `update_fact_sheet`, `get_relations`, `explain_architecture`, and a not-found case on `get_fact_sheet`
- `npm run build` (api, mcp, shared), 17 unit tests, 9 e2e tests — all green as of the latest commit
- **Re-verified against Neon (managed cloud Postgres)** after switching off native Postgres (2026-08-25): migrations applied cleanly with `prisma migrate deploy`, seed ran successfully, and the full 26-test suite (17 unit + 9 e2e) passes — see ambiguity rows #3/#4 for the transaction-timeout bug this surfaced and fixed

## 4. Known Limitations / Not Yet Verified

- `docker compose up` has not been run end-to-end — no Docker installed in this dev environment. The compose file/Dockerfile are written per spec but unverified as containers; the app/schema/migrations they wrap are the same ones verified natively above.
- No Admin UI (spec: "if practical" — deprioritized in favor of required surface + tests + docs).
- No dedicated performance/load testing pass.

## 4b. Render Deployment Readiness (added 2026-08-26)

User wants to deploy `apps/api` to Render and integrate it into a custom application, with the goal of a domain-only swap to real LeanIX later. Made the API deployment-ready:
- `GET /health` (public) — Render health-check target
- CORS enabled (`app.enableCors`), origin configurable via `CORS_ORIGIN` env var (default `*`)
- Explicit `0.0.0.0` bind (required inside a container/PaaS)
- `render.yaml` (Blueprint) at repo root — build runs `prisma migrate deploy` automatically; secrets (`DATABASE_URL`, `REDIS_URL`, `LEANIX_API_TOKEN`/`_SECRET`) are `sync: false` (user fills in via dashboard), `JWT_SECRET` auto-generated
- `docs/DEPLOYMENT.md` — step-by-step Render deploy guide, incl. the one-time seed step (not part of the build, to avoid re-seeding every deploy) and free-tier cold-start caveat
- User will click-deploy themselves (no Render account access given to this session) — **not yet actually deployed**, only prepared

**MCP deployment — explicitly deferred.** User asked how a custom app would "consume MCP." Clarified: MCP is for an LLM/agent tool-calling component, not a normal app integration path, and real LeanIX has no MCP server either — it was never part of the mock↔real domain-swap story. Our MCP server only speaks stdio (local process spawn) today; making it reachable remotely from Render would require switching to MCP's Streamable HTTP transport (a real code change). **Not done** — waiting on user to confirm their custom app actually has an agentic component before doing that work.

**Fidelity/exactness — explicitly bounded.** User has no real LeanIX license to compare against, so exactness work proceeds via deep research against public SAP LeanIX docs rather than verifying against real API traffic. User should be aware (already told them): this mock matches the *documented contract*, not real LeanIX's actual (much larger, fragment-based) GraphQL schema — true 1:1 fidelity can't be guaranteed without either a real license to diff against or the consuming app's actual real-LeanIX query/mutation shapes to verify against specifically.

## 4c. Removed a mock-only auth shortcut (2026-08-26)

User pushed back on a real divergence from real LeanIX behavior: `AuthService.validateClientCredentials` was checking `client_id.startsWith('dev-token-')` / `client_secret.startsWith('dev-secret-')` — i.e. **any** string with that prefix authenticated, not an exact registered credential. Real LeanIX validates an exact technical-user token/secret pair. This was a shortcut that would silently work in the mock and then need an actual code change at cutover (removing the assumption that "any dev-token-* string" is valid) — exactly the kind of thing the domain-only-swap goal can't tolerate.

**Fixed:**
- `AuthService.validateClientCredentials` now does `prisma.user.findFirst({ where: { apiToken: clientId, apiTokenSecret: clientSecret } })` — exact match against a real registered `User` row, no pattern.
- `packages/prisma/seed.ts` now reads `LEANIX_API_TOKEN`/`LEANIX_API_TOKEN_SECRET` from env (falling back to the documented `dev-token-12345`/`dev-secret-67890` defaults) when registering the technical user, and the upsert's `update` branch also sets those fields — so **re-running the seed with different env values rotates the credential**, the same operational shape as a real LeanIX admin rotating an API token.
- JWT claims now come from the real `User` row (`sub` = actual `User.id`, `userName` = actual email, `workspaceRole` = the user's actual stored role) instead of a fabricated `technical-user-{clientId}` string — as a side effect, `FactSheet.createdBy` now correctly references a real user id instead of a dangling string. Verified live: `createFactSheet` → `createdBy: "user-technical"` (a real row), and a `dev-token-XYZ`/`dev-secret-XYZ` credential that would have passed under the old prefix check now correctly returns `401 invalid_client`.
- Removed the now-unused `OAUTH_DEV_CLIENT_ID_PREFIX`/`OAUTH_DEV_CLIENT_SECRET_PREFIX` constants from `packages/shared`.
- Updated `apps/api/test/e2e/*.spec.ts` (they'd been using arbitrary `dev-token-e2e`/`dev-token-int` style ids that only worked under the old prefix check), `README.md`, `docs/API_REFERENCE.md`, `docs/DEPLOYMENT.md` to describe exact-match behavior and the rotate-via-reseed flow.
- All 26 tests (17 unit + 9 e2e) still pass.

## 4d. Deep research + real-LeanIX auth fix (2026-08-26)

User asked for deep research into real LeanIX behavior (no license available, so via public docs/SDKs/community + a real API client's source) to close the domain-only-swap gap. Full findings: `docs/RESEARCH_LEANIX_REAL_API.md`. Three real, sourced contract breaks found (not just simplifications): (1) OAuth uses HTTP Basic with a single API Token, not client_id/client_secret; (2) webhooks are a completely different subsystem (`/services/webhooks/v1/subscriptions`, `identifier`/`targetUrl`/`targetMethod`/`authorizationHeader`, no HMAC/events-array); (3) GraphQL filtering uses `facetFilters`, not `fieldFilters`. User chose to fix all three, auth first.

**#1 Auth — DONE, live-verified.** `AuthController`/`AuthService` now support both: real form (`Authorization: Basic base64("apitoken:" + token)`, body just needs `grant_type`) validated via `AuthService.validateApiToken` (looks up `User.apiToken` only), and the mock-only `client_id`/`client_secret` body form kept for backward compat via `validateClientCredentials` (unchanged). Verified live: real Basic-auth form issues a token; wrong username/wrong token both correctly 401; legacy body form still works. 6 new unit tests (`auth.service.spec.ts`) + 4 new e2e tests (`auth.e2e-spec.ts`). Full suite: 36/36 passing (23 unit + 13 e2e).

**#2 Webhooks — DONE, live-verified.** Full rebuild to match real LeanIX's contract exactly, sourced by reading the actual Go source of `codecentric/terraform-provider-leanix`'s HTTP client (`leanix_client.go`/`webhook_subscription.go`) directly off GitHub — the highest-confidence source available without a real license:
- Path: `/services/webhooks/v1/subscriptions` (was `/services/webhook/v1/webhooks`), full CRUD (`POST`/`GET`/`GET :id`/`PUT :id`/`DELETE :id` — was create/list/delete only)
- Request/response fields renamed to match exactly: `identifier`, `targetUrl`, `targetMethod`, `authorizationHeader`, `callback`, `tagSets` (`string[][]`, OR-within/AND-across against the fact sheet's tag ids — implemented), `workspaceConstraint`, `payloadMode`, `deliveryType` (always `"PUSH"`), `ignoreError`, `active`
- All responses wrapped `{ status: "OK", data: {...} }`, matching the real `WebhookSubscriptionResponse{Status, Subscription}` struct
- Delivery auth switched from HMAC payload-signing to sending `authorizationHeader`'s value verbatim as `Authorization` — the real mechanism. HMAC signing kept as an opt-in mock-only extra (only fires if `secret` is provided) since it's genuinely useful for testing signature-verification code, and doesn't conflict with the real contract.
- `events: string[]` kept as a **documented mock-only extension** — real LeanIX ties triggers to a separately-configured "Automation" (a whole other feature this mock doesn't implement, unverifiable without a license); omitting `events` fires on every fact-sheet event as the closest practical analog.
- `ignoreError` (default `true`, matching real LeanIX's default) now gates retries: `true` → single best-effort delivery attempt (no retry), `false` → this mock's existing retry schedule. This specific mapping is an inferred interpretation of the field name, not independently confirmed — flagged as such in code comments.
- Prisma migration `20260826073831_real_webhook_contract` applied to Neon (webhooks/webhook_deliveries tables were empty, so no data-loss concern).
- Live-verified end-to-end: register → GET → trigger via `createFactSheet` → delivery received with correct `Authorization` header (real) and correct HMAC in `X-LeanIX-Signature` (mock bonus) → DELETE returns the deleted subscription wrapped in `{status, data}`. Full suite: 36/36 (23 unit + 13 e2e).

**#3 GraphQL filtering (`facetFilters`) — not yet started.**

## 5. Next Steps (for a future session)

Everything in spec sections 1-17 (Phases 1-3) is implemented and live-verified; Phase 4 is done except the two items in §4 above. If picking this back up:

1. If Docker is available: run `docker compose -f docker/docker-compose.yml up` and confirm the containerized stack matches the natively-verified behavior above; fix any container-specific issues (paths, env propagation).
2. Optional: build a minimal Admin UI (React, per spec) if still desired.
3. Optional: add a load/perf test pass if the consuming application needs specific throughput guarantees.
