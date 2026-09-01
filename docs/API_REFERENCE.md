# API Reference

**Base URL (local):** `http://localhost:4000`
**Base URL (deployed):** `https://leanix-mock-api.onrender.com` (free tier — cold-starts after inactivity, first request can take 50s+)

**Interactive docs:**
- REST: Swagger UI at `/api-docs` (raw OpenAPI spec at `/api-docs-json`). Click **Authorize** and paste a bearer token to try requests live.
- GraphQL: open `/services/pathfinder/v1/graphql` in a browser for GraphQL Playground — full schema docs in the sidebar, introspection always on.
- MCP: no web UI (stdio transport) — see §MCP below.

This is the single reference for everything an agent needs to call this mock — and, per the domain-swap design (`LeanIX_Mock_Server_Scope.md` §0), everything it will still need once you swap `LEANIX_BASE_URL` + credentials for a real licensed workspace, **except** the subsystems flagged mock-only below.

---

## Authentication

### `POST /services/mtm/v1/oauth2/token`

Public (no auth required). `Content-Type: application/x-www-form-urlencoded`.

**Real LeanIX form — build your agent against this one** (see `docs/RESEARCH_LEANIX_REAL_API.md` §1): HTTP Basic auth header, username `apitoken`, password = a registered API Token; body only needs `grant_type=client_credentials`.

```bash
curl -u apitoken:dev-token-12345 --data grant_type=client_credentials \
  http://localhost:4000/services/mtm/v1/oauth2/token
```

**Mock-only convenience form** (not supported by real LeanIX, kept for backward compatibility — do not build an agent against this one, it won't survive the swap):

| Field | Required | Notes |
|---|---|---|
| `grant_type` | yes | must be `client_credentials` |
| `client_id` | yes | must exactly match a registered technical user's `apiToken` |
| `client_secret` | yes | must exactly match that same user's `apiTokenSecret` |

Success (200): `{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 3600, "scope": "" }`
Failure (401): `{ "error": "invalid_client", "error_description": "..." }`

All other endpoints require `Authorization: Bearer <access_token>`. Tokens are valid 1 hour — cache and refresh, don't mint one per request (the token endpoint is rate-limited in real LeanIX).

### Seeded credentials (local dev / this deployment)

| Workspace | API Token (username is literally `apitoken`) | Role |
|---|---|---|
| `ws-development` | `dev-token-12345` (or your `LEANIX_API_TOKEN`) | ADMIN |
| `ws-acquired-co` (second workspace, for cross-workspace/M&A testing) | `dev-token-acquired-11111` (or your `LEANIX_API_TOKEN_ACQUIRED`) | ADMIN |

### JWT claims

`sub, iss, aud, iat, exp, workspaceId, workspaceName, workspaceRole, userName`. **`workspaceId` scopes every query and mutation** — see §Workspaces below. This is the load-bearing claim for anything multi-tenant; don't assume there's only one workspace.

### RBAC

| Role | GraphQL read | GraphQL write | REST read | REST write |
|---|---|---|---|---|
| ADMIN | yes | yes | yes | yes |
| MEMBER | yes | yes | yes | yes |
| VIEWER | yes | no | yes | no |

---

## Workspaces — read this before building anything that compares data across tenants

Every real LeanIX customer has one or more workspaces, each with its **own meta model** (custom fields, even custom fact sheet types) and its **own fact sheet graph** — nothing is shared between workspaces. This mock now models that for real (not just in theory):

- `FactSheetType`, `RelationType`, `FactSheet`, and `TagGroup` are all scoped by `workspaceId`, taken from your JWT's `workspaceId` claim on every request — you never pass a workspace id explicitly, it's implicit in which token you authenticated with.
- A token from workspace A gets `null` reading a workspace-B fact sheet by id, and `FACT_SHEET_NOT_FOUND` trying to relate to one.
- Two fact sheet types with the same `technicalKey` (e.g. `Application`) in two different workspaces have **different ids** — never hardcode a `FactSheetType`/`RelationType` id, always resolve by `technicalKey` at runtime (`factSheetType(technicalKey: "Application") { id }` or the REST meta-model equivalent).
- Comments/To-Dos/Surveys are **not** workspace-scoped yet (documented simplification — see `LeanIX_Mock_UseCase_Coverage_Analysis.md` §6 Phase 6) — they trust whatever `factSheetId` you give them.
- Webhooks **are** workspace-scoped (real LeanIX behavior).

Two seeded workspaces exist specifically so a cross-tenant agent (e.g. M&A Architecture Assessment) has something real to test against — `ws-development`'s and `ws-acquired-co`'s Application portfolios deliberately overlap by *name*, not id (e.g. "SAP CRM" vs. "SAP Customer 360"). Authenticate twice (two tokens, per the credentials table above) to pull both.

---

## GraphQL

`POST /services/pathfinder/v1/graphql` — full schema in `apps/api/src/graphql/schemas/leanix.graphql`.

### Fact sheet types (12)

`Application`, `BusinessCapability`, `ITComponent`, `Provider`, `Process`, `Project`, `DataObject`, `Interface`, `TechnicalStack`, plus 3 added for tier-B use cases: **`TechCategory`** (governance/standards status via `standardStatus`), **`Objective`** (strategy/OKR traceability), **`AIAgent`** (AI governance — `agentType`, `riskClassification`, `modelProvider`). All implement the `BaseFactSheet` interface — query common fields directly, type-specific fields via inline fragments (`... on Application { functionalSuitability }`).

### Queries

`factSheet(id)`, `allFactSheets(filter, sort, first, after)`, `search(query, first, after)`, `allFactSheetTypes`, `factSheetType(technicalKey)`.

### Mutations

`createFactSheet(input, patches)`, `updateFactSheet(id, rev, patches, comment, validateOnly)`, `archiveFactSheet(id)`, `reviveFactSheet(id)`, `deleteFactSheet(id)` (trash-bin only), `upsertRelation(from, to, type, description)`, `deleteRelation(id)`, `createComment(factSheetId, message)`.

- `rev` (optional): optimistic-concurrency check — omit to skip, pass the fact sheet's current `rev` to reject stale writes.
- `validateOnly: true`: runs every patch's validation then rolls back, returns the fact sheet unchanged — use this to dry-run a batch of patches before committing.

### Patch paths (for `updateFactSheet`'s `patches: [{op, path, value}]`)

| Path | Notes |
|---|---|
| `/name`, `/description` | replace only |
| `/externalId` | plain string or real LeanIX's `{"type":"ExternalId","externalId":"..."}` object |
| `/lifecycle/{phaseName}` | per-phase (`plan`/`phaseIn`/`active`/`phaseOut`/`endOfLife`), value = date string |
| `/lifecycle` | whole-object replace, inline JSON or a JSON-encoded string |
| `/qualitySeal` | `APPROVED`/`approve`, `BROKEN`/`broken`, `DRAFT`, `REJECTED`/`reject` |
| `/tags` (add), `/tags/{tagId}` (remove) | |
| `/{relationTypeKey}` (add), `/{relationTypeKey}/{relationId}` (replace/remove) | alternative to `upsertRelation`/`deleteRelation` |
| `/{customAttributeKey}` | e.g. `/functionalSuitability`, `/standardStatus`, `/agentType`, `/riskClassification`, `/modelProvider` |

`lxState` (read-only): real LeanIX's field for quality-seal state (`APPROVED`/`BROKEN_QUALITY_SEAL`), derived from `qualitySeal`.

### Filtering

```graphql
allFactSheets(filter: { facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }] }) {
  totalCount edges { node { id name } } filterOptions { facets { facetKey results { name key } } } }
}
```
Well-known `facetKey`s: `"FactSheetTypes"` (technicalKey), `"_TAGS_"` (tag ids); anything else is a custom attribute's technicalKey. `operator`: `OR` (default) or `AND`.

### Fields worth knowing about

- `comments: [Comment!]!` — on every fact sheet type now (Phase 1 addition).
- `relations: [Relation!]!` — both directions merged; a relation you're the *target* of still shows up here with `source`/`target` correctly oriented.
- `attributes: [AttributeValue!]!` — generic form of every custom field; type-specific named fields (e.g. `standardStatus`) are sugar over the same data — both work, use whichever is more convenient.

---

## REST endpoints

| Method | Path | Role | Subsystem |
|---|---|---|---|
| POST | `/services/mtm/v1/oauth2/token` | public | Auth |
| GET | `/health` | public | health check |
| GET/POST | `/services/pathfinder/v1/factSheets/{id}/comments` | any / ADMIN,MEMBER | Comments |
| POST | `/services/todo/v1` | ADMIN,MEMBER | To-Dos |
| GET | `/services/todo/v1`, `/services/todo/v1/{id}` | any | To-Dos |
| PATCH | `/services/todo/v1/{id}` | ADMIN,MEMBER | To-Dos |
| POST | `/services/todo/v1/{id}/complete` | ADMIN,MEMBER | To-Dos |
| POST/GET | `/services/survey/v1/definitions`, `/definitions/{id}` | ADMIN,MEMBER (POST) / any (GET) | Surveys |
| POST/GET | `/services/survey/v1/runs`, `/runs/{id}` | ADMIN,MEMBER (POST) / any (GET) | Surveys |
| POST/GET | `/services/survey/v1/runs/{id}/invitations` | ADMIN,MEMBER (POST) / any (GET) | Surveys |
| POST | `/services/survey/v1/runs/{id}/responses` | any (respondent submitting their own answer) | Surveys |
| GET | `/services/survey/v1/runs/{id}/results` | any | Surveys |
| POST | `/services/aiagent/v1/discovery` | ADMIN,MEMBER | AI Agent Discovery — upserts an agent card as an `AIAgent` fact sheet |
| POST | `/services/integration-api/v1/configurations` | ADMIN,MEMBER | Integration API (LDIF) |
| GET | `/services/integration-api/v1/configurations` | ADMIN,MEMBER | |
| POST | `/services/integration-api/v1/synchronizationRuns` | ADMIN,MEMBER | inline LDIF, async |
| POST | `/services/integration-api/v1/synchronizationRuns/withUrlInput` | ADMIN,MEMBER | fetch LDIF from URL |
| GET | `/services/integration-api/v1/synchronizationRuns/{id}` | ADMIN,MEMBER | status + counts |
| GET | `/services/integration-api/v1/synchronizationRuns/{id}/logs` | ADMIN,MEMBER | row-level logs |
| POST/GET/PUT/DELETE | `/services/webhooks/v1/subscriptions[/{id}]` | ADMIN,MEMBER | Webhooks (real LeanIX contract) |

Full request/response shapes for every REST route: **use Swagger UI at `/api-docs`** rather than hand-copying them here — it's generated from the actual DTOs and stays accurate as the code changes; this file would just drift out of sync (see the "stale doc" lesson in `docs/BUILD_STATUS.md`).

Every REST response is wrapped `{ "status": "OK", "data": ... }`, matching real LeanIX's REST envelope.

---

## MCP server

Two ways to reach it — both expose the same 8 tools (`search_fact_sheets`, `get_fact_sheet`, `get_relations`, `create_fact_sheet`, `update_fact_sheet`, `get_meta_model`, `get_reports`, `explain_architecture`) and are workspace-scoped the same way as REST/GraphQL.

### Remote — Streamable HTTP (matches real LeanIX's actual contract)

Verified against SAP's own setup doc (`github.com/SAP/leanix-ai-plugins/blob/main/MCP-SETUP.md`) — this is the one to build an agent against if you want it to survive the swap to a real licensed workspace.

```
POST /services/mcp-server/v1/mcp?toolsets=inventory
Authorization: Token <api-token>      # or: Bearer <jwt>
```

- **Local:** `http://localhost:4000/services/mcp-server/v1/mcp?toolsets=inventory`
- **Deployed:** `https://leanix-mock-api.onrender.com/services/mcp-server/v1/mcp?toolsets=inventory`
- Real LeanIX's URL shape is `https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp` (technical user) or `https://mcp.leanix.net/services/mcp-server/v1/mcp` (OAuth browser flow, no subdomain) — this mock doesn't have subdomains, one base URL covers both.
- `Authorization: Token <api-token>` — same registered technical-user token as everywhere else (`dev-token-12345`, or `dev-token-acquired-11111` for `ws-acquired-co`).
- `Authorization: Bearer <jwt>` — a JWT already obtained from `/services/mtm/v1/oauth2/token` also works directly.
- `?toolsets=` — real LeanIX returns nothing if omitted; this mock defaults to `inventory` (its only toolset) when omitted, as a leniency for platforms that forget the param. Any other value returns zero tools.
- Stateless: a fresh MCP server instance per request, no session to manage.
- Example client config (Claude Desktop-style, via `mcp-remote`):
  ```json
  { "mcpServers": { "leanix-mock": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "http://localhost:4000/services/mcp-server/v1/mcp?toolsets=inventory", "--header", "Authorization: Token dev-token-12345"]
  } } }
  ```

### Local — stdio (for Claude Desktop or other subprocess-spawning clients)

```bash
npm run build --workspace=apps/mcp
LEANIX_BASE_URL=http://localhost:4000 \
LEANIX_API_TOKEN=dev-token-12345 \
LEANIX_API_TOKEN_SECRET=dev-secret-67890 \
node apps/mcp/dist/server.js
```

Point an MCP client (Claude Desktop, or `@modelcontextprotocol/sdk`'s `Client`/`StdioClientTransport`) at that command. Does its own OAuth exchange internally at startup, using one fixed technical-user credential from env vars — for per-caller/multi-workspace credentials, use the remote HTTP endpoint above instead, which resolves the `Authorization` header on every request.

---

## Error codes

| Code | HTTP | Where it shows up |
|---|---|---|
| `UNAUTHENTICATED` | 401 | missing/invalid bearer token |
| `FORBIDDEN` | 403 | role not permitted |
| `FACT_SHEET_NOT_FOUND` | 404 | missing id, or a real id from a **different workspace** |
| `FACT_SHEET_TYPE_NOT_FOUND` | 404 | unknown `type` in create/filter for your workspace |
| `INVALID_PATCH` | 400 | bad op/path, empty name, stale `rev`, delete-outside-trash-bin |
| `DUPLICATE_EXTERNAL_ID` | 409 | externalId collision within a type (per workspace) |
| `RELATION_NOT_FOUND` | 404 | unknown relation type/instance |
| `RATE_LIMIT_EXCEEDED` | 429 | `Retry-After` header set |
| `INVALID_LDIF` | 400 | malformed LDIF/integration config |
| `SYNC_RUN_NOT_FOUND` | 404 | |
| `WEBHOOK_DELIVERY_FAILED` | 502 | reserved, not currently exposed |
| `COMMENT_NOT_FOUND`, `TODO_NOT_FOUND`, `SURVEY_DEFINITION_NOT_FOUND`, `SURVEY_RUN_NOT_FOUND`, `SURVEY_INVITATION_NOT_FOUND` | 404 | |
| `VALIDATION_ERROR` | 400 | generic required-field validation (Comments/To-Dos/Surveys/AI Agent Discovery) |

GraphQL errors carry the code in `extensions.code`, and **come back as HTTP 200** (standard GraphQL behavior) — check `errors`, don't just check `response.ok`. REST errors are `{ "error": "<CODE>", "error_description": "<message>" }`.

---

## Rate limiting

Every authenticated response includes `X-RateLimit-User-Limit` (1800/min default), `X-RateLimit-Workspace-Limit` (1200/min default), and the tighter of the two as `X-RateLimit-Limit`/`X-RateLimit-Remaining`/`X-RateLimit-Reset`. On 429, `Retry-After` is set. Toggle with `MOCK_RATE_LIMIT_ENABLED`. **Not applied to the token endpoint itself** — known gap, see `LeanIX_Mock_UseCase_Coverage_Analysis.md` §5.

## Webhooks

Real LeanIX contract exactly (`docs/RESEARCH_LEANIX_REAL_API.md` §2): `identifier`, `targetUrl`, `targetMethod`, `authorizationHeader` (sent verbatim as `Authorization` on delivery — no payload signing in real LeanIX), `callback`, `tagSets`, `workspaceConstraint`, `payloadMode`, `active`, `ignoreError`.

Mock-only convenience fields (won't survive the swap): `events: string[]` (restrict to event types, omit = fire on everything), `secret` (adds HMAC-SHA256 `X-LeanIX-Signature`), `ignoreError: false` (opts into a 6-attempt retry schedule via BullMQ; real default `true` never retries).

---

## What's mock-only — don't build agent logic that depends on these surviving the swap

- Webhook `events`/`secret`/HMAC signing (§Webhooks above)
- The mock-only OAuth `client_id`/`client_secret` body form
- `TechCategory`/`Objective`/`AIAgent` fact sheet types and the `standardStatus`/`agentType`/`riskClassification`/`modelProvider` fields — plausible, not verified against a real workspace (no license to check against)
- The AI Agent Discovery endpoint's request shape (best-effort, see `apps/api/src/rest/dto/ai-agent-discovery.dto.ts`)
- `upsertRelation`'s argument names (`from`/`to`/`type`/`description`) — real, but argument *names* weren't independently confirmed
- MCP `Bearer <raw-api-token>` fallback (accepting a raw token under the `Bearer` scheme, not just `Token`) — mock-only leniency, real LeanIX may be stricter about which scheme goes with which credential type
- MCP `?toolsets=` omitted defaulting to `inventory` rather than returning nothing — mock-only leniency, opposite of real LeanIX's documented default
- The local stdio MCP path (`apps/mcp/src/server.ts`) — real LeanIX has no stdio transport at all; it's a local dev convenience only. The remote Streamable HTTP endpoint is the one with a real counterpart.

Everything else (auth form, GraphQL core, patch mechanics, LDIF state machine, webhook subscription contract, the remote MCP endpoint's URL shape/transport/`Token`-or-`Bearer` auth) is sourced from real LeanIX documentation/client code — see `docs/RESEARCH_LEANIX_REAL_API.md` for citations.
