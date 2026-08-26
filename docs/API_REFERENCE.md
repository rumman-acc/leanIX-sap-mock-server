# API Reference

Base URL (local): `http://localhost:4000`

**Interactive docs:** REST endpoints (auth/Integration API/Webhooks) are documented live via Swagger UI at `/api-docs` (raw spec at `/api-docs-json`). The GraphQL endpoint is self-documenting via introspection — open it in a browser for GraphQL Playground.

## Authentication

### `POST /services/mtm/v1/oauth2/token`

Public (no auth required). `Content-Type: application/x-www-form-urlencoded`.

**Real LeanIX form** (use this — see `docs/RESEARCH_LEANIX_REAL_API.md` §1): HTTP Basic auth header, username `apitoken`, password = a registered API Token (seeded from `LEANIX_API_TOKEN`, default `dev-token-12345`); body only needs `grant_type=client_credentials`.

**Mock-only convenience form** (not supported by real LeanIX, kept for backward compatibility):

| Field | Required | Notes |
|---|---|---|
| `grant_type` | yes | must be `client_credentials` |
| `client_id` | yes | must exactly match a registered technical user's `apiToken` (default `dev-token-12345`) |
| `client_secret` | yes | must exactly match that same user's `apiTokenSecret` (seeded from `LEANIX_API_TOKEN_SECRET`, default `dev-secret-67890`) |

Success (200):
```json
{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 3600, "scope": "" }
```
Failure (401): `{ "error": "invalid_client", "error_description": "Client authentication failed" }`

All other endpoints require `Authorization: Bearer <access_token>`.

### JWT claims

`sub, iss, aud, iat, exp, workspaceId, workspaceName, workspaceRole, userName`. `workspaceRole` is always `ADMIN` for mock dev tokens.

### RBAC

| Role | GraphQL read | GraphQL write | Integration/Webhook API |
|---|---|---|---|
| ADMIN | yes | yes | yes |
| MEMBER | yes | yes | yes |
| VIEWER | yes | no | no |

## GraphQL

`POST /services/pathfinder/v1/graphql` — full schema in `apps/api/src/graphql/schemas/leanix.graphql` (matches spec Appendix A verbatim, plus an explicit `schema { query: Query mutation: Mutation }` block — see `docs/BUILD_STATUS.md` ambiguity #3 for why). Introspection is always on.

**Queries:** `factSheet(id)`, `allFactSheets(filter, sort, first, after)`, `search(query, first, after)`, `allFactSheetTypes`, `factSheetType(technicalKey)`.

**Mutations:** `createFactSheet(input)`, `updateFactSheet(id, patches)`, `archiveFactSheet(id)`, `reviveFactSheet(id)`, `deleteFactSheet(id)` (trash-bin only).

**Patch paths:** `/name`, `/description`, `/externalId`, `/lifecycle` (replace only); `/tags` (add), `/tags/{tagId}` (remove); `/{relationTypeKey}` (add, value = target fact sheet id), `/{relationTypeKey}/{relationId}` (replace/remove); `/{customAttributeKey}` (replace/remove) for type-specific fields like `functionalSuitability`.

## REST

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/services/mtm/v1/oauth2/token` | public | see above |
| POST | `/services/integration-api/v1/configurations` | ADMIN/MEMBER | upserted by `(connectorId, connectorType)` |
| GET | `/services/integration-api/v1/configurations` | ADMIN/MEMBER | list all |
| POST | `/services/integration-api/v1/synchronizationRuns` | ADMIN/MEMBER | inline LDIF, returns 202 + `{id, status: "CREATED"}`, processes asynchronously |
| POST | `/services/integration-api/v1/synchronizationRuns/withUrlInput` | ADMIN/MEMBER | fetches LDIF content from `url` |
| GET | `/services/integration-api/v1/synchronizationRuns/{id}` | ADMIN/MEMBER | status + counts |
| GET | `/services/integration-api/v1/synchronizationRuns/{id}/logs` | ADMIN/MEMBER | row-level sync logs (not in spec, added for debuggability) |
| POST | `/services/webhooks/v1/subscriptions` | ADMIN/MEMBER | register (real LeanIX path/contract — see below) |
| GET | `/services/webhooks/v1/subscriptions` | ADMIN/MEMBER | list |
| GET | `/services/webhooks/v1/subscriptions/{id}` | ADMIN/MEMBER | get one |
| PUT | `/services/webhooks/v1/subscriptions/{id}` | ADMIN/MEMBER | update |
| DELETE | `/services/webhooks/v1/subscriptions/{id}` | ADMIN/MEMBER | delete |

## Error codes

| Code | HTTP | Where it shows up |
|---|---|---|
| `UNAUTHENTICATED` | 401 | missing/invalid bearer token |
| `FORBIDDEN` | 403 | role not permitted (e.g. VIEWER on a mutation) |
| `FACT_SHEET_NOT_FOUND` | 404 | mutating a missing fact sheet id |
| `FACT_SHEET_TYPE_NOT_FOUND` | 404 | unknown `type` in create/filter |
| `INVALID_PATCH` | 400 | bad op/path, empty name, delete-outside-trash-bin, etc. |
| `DUPLICATE_EXTERNAL_ID` | 409 | externalId collision within a type |
| `RELATION_NOT_FOUND` | 404 | unknown relation type/instance in a patch |
| `RATE_LIMIT_EXCEEDED` | 429 | sliding-window limit hit (`Retry-After` header set) |
| `INVALID_LDIF` | 400 | malformed LDIF or integration configuration payload |
| `SYNC_RUN_NOT_FOUND` | 404 | unknown sync run id |
| `WEBHOOK_DELIVERY_FAILED` | 502 | reserved for future synchronous webhook test-delivery endpoint (not currently exposed) |

GraphQL errors carry the code in `extensions.code`. REST errors are `{ "error": "<CODE>", "error_description": "<message>" }`.

## Rate limiting

Every authenticated response includes `X-RateLimit-User-Limit` (1800/min), `X-RateLimit-Workspace-Limit` (1200/min), and the tighter of the two as `X-RateLimit-Limit`/`X-RateLimit-Remaining`/`X-RateLimit-Reset`. On 429, `Retry-After` is set. Toggle with `MOCK_RATE_LIMIT_ENABLED`.

## Webhooks

**Request body** (matches real LeanIX's `WebhookSubscription` contract exactly — see `docs/RESEARCH_LEANIX_REAL_API.md` §2, sourced from a real LeanIX API client's Go source): `identifier` (required, human-readable label), `targetUrl` (required), `targetMethod` (default `POST`), `authorizationHeader`, `callback`, `tagSets` (`string[][]`, OR within a group / AND across groups, matched against the fact sheet's tag ids), `workspaceConstraint` (default `ANY`), `payloadMode` (default `DEFAULT`), `active` (default `true`), `ignoreError` (default `true`).

**Response:** `{ "status": "OK", "data": { "id", "identifier", "targetUrl", "targetMethod", "deliveryType": "PUSH", "active", ... } }` — every subscription endpoint wraps its payload this way, matching real LeanIX.

**Delivery auth:** real LeanIX sends `authorizationHeader`'s value verbatim as the `Authorization` header on every delivery — there is no payload-signing scheme in the real product.

**Mock-only convenience fields** (not in real LeanIX — this mock doesn't implement the "Automations" feature real webhook triggers are actually configured through, since there's no license to verify that API against):
- `events: string[]` — restrict delivery to these types: `FACT_SHEET_CREATED`, `FACT_SHEET_UPDATED`, `FACT_SHEET_ARCHIVED`, `RELATION_CREATED`, `FACT_SHEET_FIELD_UPDATED` (no `FACT_SHEET_DELETED` — LeanIX archives then auto-deletes, no delete event ever fires). Omit to fire on every fact-sheet event.
- `secret: string` — additionally HMAC-SHA256-signs deliveries (`X-LeanIX-Signature: sha256=<hmac-of-raw-json-body>`), alongside bonus `X-LeanIX-Event`/`X-LeanIX-Delivery` headers.
- `ignoreError: false` — opt into a retry schedule (delay before that attempt: 1→immediate, 2→5s, 3→25s, 4→2m, 5→10m, 6-10→1h; only 2xx counts as success) via a durable BullMQ queue. Default (`true`, matching real LeanIX's default) does not retry. Every attempt is persisted to `webhook_deliveries` either way.
