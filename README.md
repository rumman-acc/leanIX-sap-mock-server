# LeanIX Development Simulator

A LeanIX-compatible mock server: OAuth2 + JWT auth, GraphQL (schema-matched to real LeanIX), REST integration/webhook APIs, LDIF processing, and an MCP server — all backed by real PostgreSQL persistence (no in-memory state) so you can develop and test against LeanIX without a real account.

See [`LeanIX_Mock_Server_Technical_Specification.md`](./LeanIX_Mock_Server_Technical_Specification.md) for the full spec this implements, and [`docs/BUILD_STATUS.md`](./docs/BUILD_STATUS.md) for exactly what's implemented, live-verified, and any deviations/ambiguity resolutions.

## Prerequisites

- Node.js 20.x+ (tested on 20 and 24)
- PostgreSQL 16.x — either via Docker, or a native/local install
- Redis 7.x — either via Docker, or a managed instance (Upstash, Redis Cloud, etc.) — see [`docs/REDIS_SETUP.md`](./docs/REDIS_SETUP.md)
- Docker + Docker Compose (optional — only needed if you want the containerized stack instead of running Postgres/Redis yourself)

## Project structure

```
apps/api    NestJS server: GraphQL, REST, auth, LDIF, webhooks
apps/mcp    MCP server exposing the same data via 8 tools over stdio
packages/prisma  Prisma schema, migrations, seed script
packages/shared  Types/constants shared between api, mcp, and the seed script
docker/     Dockerfile + docker-compose for the full stack
scripts/    setup.sh / seed-workspace.sh convenience scripts
docs/       API reference, migration guide, build status
```

GraphQL/REST/auth are thin adapters over shared domain services (`FactSheetService`, `MetaModelService`, etc.) — see spec section 29. Business logic lives in one place regardless of which transport calls it.

## 1. Install

```bash
npm install
```

This is an npm-workspaces monorepo (`apps/*`, `packages/*`) — one install at the root wires everything up.

## 2. Environment configuration

```bash
cp .env.example .env
```

Key variables (full list in `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string (local `redis://localhost:6379/0` or managed `rediss://...`) |
| `LEANIX_API_TOKEN` / `LEANIX_API_TOKEN_SECRET` | Dev OAuth credentials — must start with `dev-token-` / `dev-secret-` |
| `MOCK_RATE_LIMIT_ENABLED` | Set `false` if you don't have Redis available yet |
| `MOCK_WEBHOOK_DELIVERY_ENABLED` | Set `false` to disable outbound webhook calls |
| `MOCK_TRASH_BIN_RETENTION_DAYS` | Default 90, per spec |

If you don't have Redis yet, set `MOCK_RATE_LIMIT_ENABLED=false` and everything except rate limiting and webhook retry scheduling will work; BullMQ (webhooks) does require a reachable Redis.

## 3. Start Postgres + Redis

**Option A — Docker Compose (needs Docker installed):**

```bash
docker compose -f docker/docker-compose.yml up -d postgres redis
```

**Option B — native/managed services:** point `DATABASE_URL`/`REDIS_URL` in `.env` at whatever Postgres/Redis you already have running. This repo has been tested against both a native local Postgres and a managed **Neon** cloud Postgres instance, plus a managed **Redis Cloud** instance — Docker Compose is provided for portability/CI but isn't the only supported path.

If your Postgres provider uses a PgBouncer-based pooled endpoint (e.g. Neon's `-pooler` host), append `&pgbouncer=true` to `DATABASE_URL` — this tells Prisma to disable prepared-statement caching, which PgBouncer's transaction-pooling mode doesn't support. Expect noticeably higher latency per request against any remote database compared to local Postgres — that's normal network round-trip time, not a bug (see `docs/BUILD_STATUS.md` for the interactive-transaction-timeout fix this required).

## 4. Database migration + seed

```bash
npm run prisma:generate
npm run prisma:migrate     # creates the schema
npm run prisma:seed        # loads the default meta model + sample data
```

Or all at once: `bash scripts/setup.sh` (installs deps too).

Seed data includes: a `development` workspace, a technical user, the 9 default fact sheet types (Application, BusinessCapability, ITComponent, Provider, Process, Project, DataObject, Interface, TechnicalStack) with their attributes, 5 relation types, and a handful of sample Applications/ITComponents/BusinessCapability/Provider with relations, tags, and a subscription. IDs are deterministic (`fs-app-sap-crm`, etc.) so re-seeding is idempotent.

## 5. Run the API

```bash
npm run dev
# or: npm run start:dev --workspace=apps/api
```

Server listens on `http://localhost:4000` by default.

## 6. Obtain a token

```bash
curl -X POST http://localhost:4000/services/mtm/v1/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=client_credentials&client_id=dev-token-12345&client_secret=dev-secret-67890"
```

Two supported forms — see `docs/RESEARCH_LEANIX_REAL_API.md` §1 for sourcing:

- **Real LeanIX form (use this for your custom application)** — HTTP Basic auth, username literally `apitoken`, password = a single registered API Token:
  ```bash
  curl -u apitoken:dev-token-12345 --data grant_type=client_credentials \
    http://localhost:4000/services/mtm/v1/oauth2/token
  ```
- **Mock-only convenience form** (kept for backward compatibility, not supported by real LeanIX) — `client_id`/`client_secret` in the body, as shown in the curl example above.

Both validate against the same registered technical user (default `dev-token-12345`/`dev-secret-67890`, `workspaceRole: ADMIN`). Set `LEANIX_API_TOKEN`/`LEANIX_API_TOKEN_SECRET` before running `npm run prisma:seed` to register your own — the Basic-auth password only needs to match `LEANIX_API_TOKEN`. The returned JWT is valid for 1 hour.

## 6b. Explore the API

- **REST** (auth, Integration API, Webhooks): Swagger UI at [http://localhost:4000/api-docs](http://localhost:4000/api-docs) — every endpoint, request/response shape, and a "Try it out" button (click **Authorize** and paste a bearer token from step 6 first). Raw OpenAPI JSON at `/api-docs-json`.
- **GraphQL** (Fact Sheets, Meta Model, Search): GraphQL Playground at [http://localhost:4000/services/pathfinder/v1/graphql](http://localhost:4000/services/pathfinder/v1/graphql) (open it in a browser) — full schema docs in the sidebar, autocomplete, and an explorer. This is where Fact Sheet CRUD lives; it isn't in the REST/Swagger surface.
- **MCP**: no web UI (it's a stdio-based protocol for AI clients, not HTTP) — see section 11 below to run it and point an MCP client (e.g. Claude Desktop) at it, or use `@modelcontextprotocol/sdk`'s `Client`/`StdioClientTransport` to call `tools/list` yourself.

## 7. GraphQL usage

Endpoint: `POST /services/pathfinder/v1/graphql` (also opens as a GraphQL Playground in a browser).

```bash
TOKEN="<access_token from step 6>"

curl -X POST http://localhost:4000/services/pathfinder/v1/graphql \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query": "query { allFactSheets(first: 5) { totalCount edges { node { id name type } } } }"}'
```

Create / update / archive / revive:

```bash
curl -X POST http://localhost:4000/services/pathfinder/v1/graphql \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "query": "mutation($input: BaseFactSheetInput!) { createFactSheet(input: $input) { factSheet { id name status qualitySeal } } }",
    "variables": { "input": { "name": "My App", "type": "Application", "externalId": "EXT-100" } }
  }'
```

```bash
curl -X POST http://localhost:4000/services/pathfinder/v1/graphql \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "query": "mutation($id: ID!, $patches: [Patch!]!) { updateFactSheet(id: $id, patches: $patches) { factSheet { id name } } }",
    "variables": { "id": "<fact-sheet-id>", "patches": [{ "op": "replace", "path": "/name", "value": "Renamed App" }] }
  }'
```

Relation patches use the relation type as the path and (for replace/remove) the relation instance id: `{"op":"add","path":"/relApplicationToITComponent","value":"<target-fact-sheet-id>"}`.

## 8. REST usage

Integration configurations:

```bash
curl -X POST http://localhost:4000/services/integration-api/v1/configurations \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"SAP Connector","connectorType":"sap-connector","connectorId":"sap-prod","connectorVersion":"1.0.0","processingDirection":"inbound","processingMode":"partial","processors":[]}'
```

## 9. LDIF usage

```bash
curl -X POST http://localhost:4000/services/integration-api/v1/synchronizationRuns \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "connectorType": "csv-import", "connectorId": "csv-001", "connectorVersion": "1.0.0",
    "lxVersion": "1.0.0", "processingDirection": "inbound", "processingMode": "partial",
    "content": [{ "type": "Application", "id": "SRC-1", "data": { "name": "Imported App", "externalId": "EXT-IMPORT-1" } }]
  }'
# => { "id": "<sync-run-id>", "status": "CREATED", ... }

curl http://localhost:4000/services/integration-api/v1/synchronizationRuns/<sync-run-id> \
  -H "Authorization: Bearer $TOKEN"
# poll until status is FINISHED or FAILED

curl http://localhost:4000/services/integration-api/v1/synchronizationRuns/<sync-run-id>/logs \
  -H "Authorization: Bearer $TOKEN"
```

See Appendix B in the spec for more LDIF examples (relations, full-mode replace) — all implemented, see `docs/BUILD_STATUS.md`.

## 10. Webhook testing

```bash
curl -X POST http://localhost:4000/services/webhook/v1/webhooks \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://your-app.example.com/webhooks/leanix","events":["FACT_SHEET_CREATED","FACT_SHEET_UPDATED"],"secret":"your-webhook-secret"}'
```

Every delivery includes `X-LeanIX-Event`, `X-LeanIX-Delivery`, and `X-LeanIX-Signature: sha256=<hmac>` headers — verify with `HMAC-SHA256(secret, raw_request_body)`. Failed deliveries retry on the schedule in spec section 10.4 (0s / 5s / 25s / 2m / 10m / 1h, max 10 attempts, 50s timeout per attempt) via a durable BullMQ queue — safe across server restarts.

A quick local receiver for testing:

```bash
node -e "require('http').createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{console.log(req.headers,b);res.end('ok')})}).listen(4001)"
```

## 11. MCP server

```bash
npm run build --workspace=apps/mcp
LEANIX_BASE_URL=http://localhost:4000 \
LEANIX_API_TOKEN=dev-token-12345 \
LEANIX_API_TOKEN_SECRET=dev-secret-67890 \
node apps/mcp/dist/server.js
```

Point any MCP client (Claude Desktop, etc.) at that command. Tools: `search_fact_sheets`, `get_fact_sheet`, `get_relations`, `create_fact_sheet`, `update_fact_sheet`, `get_meta_model`, `get_reports`, `explain_architecture`.

## 12. Running tests

```bash
npm run test --workspace=apps/api       # unit tests (mocked Prisma)
npm run test:e2e --workspace=apps/api   # e2e tests — boots the full app against your real Postgres/Redis
```

Both suites are green in this repo's own dev environment (17 unit + 9 e2e as of the last commit — see `docs/BUILD_STATUS.md` for exactly what each covers).

## Deploying

To make this reachable by a real application (not just localhost), see [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — one-click Render deploy via the included `render.yaml`.

## Known limitations

- No Admin UI — spec marks this "if practical"; skipped in favor of the required API surface, tests, and docs. GraphQL Playground (enabled at the GraphQL endpoint) covers interactive exploration instead.
- `docker compose up` itself hasn't been run end-to-end in this environment (no local Docker install) — the compose/Dockerfile are written per spec and should work, but verify on first use and see `docs/BUILD_STATUS.md` for exactly what *was* live-tested (native Postgres + managed Redis, same schema/migrations).
- See `docs/BUILD_STATUS.md` §1 for every ambiguity resolution made against the spec (meta-model allowed-values, GraphQL `Subscription` type-name collision, completion formula edge case, etc).
