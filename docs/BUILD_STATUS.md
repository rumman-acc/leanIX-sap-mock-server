# LeanIX Mock Server — Build Status

> **Ground rule:** This file is the single source of truth for build progress. Update it after every meaningful milestone (file group added, phase completed, test run, blocker hit). Any new conversation/session picking up this work MUST read this file first before touching code.

Last updated: 2026-08-25 (session start)

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

### Phase 2 — Integration
- [ ] Integration API (configurations, synchronizationRuns, withUrlInput, status)
- [ ] LDIF validation
- [ ] LDIF processing (partial/full)
- [ ] InboundFactSheet processor
- [ ] Sync run lifecycle + logs
- [ ] SHA-256 sync mapping / change detection
- [ ] Relations CRUD via patches
- [ ] Tags
- [ ] Subscriptions
- [ ] Webhook registration/management REST API
- [ ] Webhook dispatch (BullMQ) + HMAC signature
- [ ] Webhook retry schedule (10 attempts, 50s timeout)
- [ ] Tests

### Phase 3 — MCP
- [ ] MCP server scaffold (`apps/mcp`)
- [ ] Tools: search_fact_sheets, get_fact_sheet, get_relations, create_fact_sheet, update_fact_sheet, get_meta_model, get_reports, explain_architecture
- [ ] Shared auth w/ REST/GraphQL

### Phase 4 — Polish
- [ ] Admin UI (best-effort)
- [ ] GraphQL Playground/GraphiQL enabled
- [ ] Full test suite pass
- [ ] Documentation (README, API_REFERENCE, MIGRATION_GUIDE)
- [ ] Sample data seed scripts
- [ ] Performance pass

## 3. What Actually Works Right Now (verified by running commands, not assumed)

_(nothing yet — updated as each piece is verified)_

## 4. Known Limitations / Not Yet Verified

- Redis-dependent behavior (rate limiting, BullMQ jobs, webhook retry timers) not yet live-tested — waiting on managed Redis URL from user.
- Docker Compose stack not yet run end-to-end (no Docker locally).

## 5. Next Steps

1. Scaffold monorepo (package.json, tsconfig, Prisma schema).
2. Stand up NestJS app skeleton + Prisma against native Postgres.
3. Implement Phase 1 modules incrementally, testing each against native Postgres.
