# LeanIX Mock Server — Build Status

> **Ground rule:** This file is the single source of truth for build progress. Update it after every meaningful milestone (file group added, phase completed, test run, blocker hit). Any new conversation/session picking up this work MUST read this file first before touching code.

Last updated: 2026-08-25 — Phases 1-3 complete and live-verified, Phase 4 mostly done (Admin UI + perf pass intentionally skipped, see below)

---

## 0. Environment Facts (discovered, not assumptions)

- Docker is **NOT installed** in this dev environment (stale PATH entry only, no `docker` binary, no `Program Files\Docker`). Docker Compose files are still written per spec for portability/CI, but cannot be executed locally right now.
- **PostgreSQL 18** is running natively on `localhost:5432` (Windows service), reachable with `postgres/postgres`. We use this native instance for local dev/testing instead of the Postgres container.
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

## 4. Known Limitations / Not Yet Verified

- `docker compose up` has not been run end-to-end — no Docker installed in this dev environment. The compose file/Dockerfile are written per spec but unverified as containers; the app/schema/migrations they wrap are the same ones verified natively above.
- No Admin UI (spec: "if practical" — deprioritized in favor of required surface + tests + docs).
- No dedicated performance/load testing pass.

## 5. Next Steps (for a future session)

Everything in spec sections 1-17 (Phases 1-3) is implemented and live-verified; Phase 4 is done except the two items in §4 above. If picking this back up:

1. If Docker is available: run `docker compose -f docker/docker-compose.yml up` and confirm the containerized stack matches the natively-verified behavior above; fix any container-specific issues (paths, env propagation).
2. Optional: build a minimal Admin UI (React, per spec) if still desired.
3. Optional: add a load/perf test pass if the consuming application needs specific throughput guarantees.
