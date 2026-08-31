# SAP LeanIX Mock Server — What to Mock

**Goal:** build agents, AI workflows and automations now, against a mock that is contract-faithful enough that going live is a change to `LEANIX_BASE_URL` + credentials and nothing else.

**The governing principle:** the mock is not a fake data source, it is a **fake implementation of a contract**. Everything below is scoped by "does the real API do this, and would my agent break if the mock didn't?"

---

## 0. The swap surface — design this first

Everything else is downstream of getting this right. If any LeanIX-specific value is hardcoded anywhere except this layer, the swap will not be clean.

### Single config surface

```bash
# --- Identity / region ---
LEANIX_BASE_URL=https://mock.local:8443        # → https://eu.leanix.net
LEANIX_REGION=eu                                # eu | us | us-2 | au | ca | de | ch | uk
LEANIX_WORKSPACE_ID=00000000-0000-0000-0000-000000000000
LEANIX_WORKSPACE_NAME=sandbox

# --- Credentials ---
LEANIX_API_TOKEN=mock-token
LEANIX_CLIENT_ID=apitoken
LEANIX_CLIENT_SECRET=mock-secret

# --- Derived endpoints (never hardcode these downstream) ---
LEANIX_GRAPHQL_URL=${LEANIX_BASE_URL}/services/pathfinder/v1/graphql
LEANIX_TOKEN_URL=${LEANIX_BASE_URL}/services/mtm/v1/oauth2/token
LEANIX_INTEGRATION_URL=${LEANIX_BASE_URL}/services/integration-api/v1
LEANIX_MCP_URL=${LEANIX_BASE_URL}/mcp

# --- Per-service mode flags (enables hybrid cutover) ---
LEANIX_MODE_GRAPHQL=mock      # mock | real
LEANIX_MODE_INTEGRATION=mock
LEANIX_MODE_WEBHOOKS=mock
LEANIX_MODE_MCP=mock
```

### Rules

- **One HTTP client wrapper.** All auth, retry, pagination and error translation live there. Agents never call `fetch`/`requests` directly.
- **Per-service mode flags.** When the licence lands you will not flip everything at once. You will point GraphQL at real and keep webhooks mocked for a week.
- **Real TLS on the mock.** Self-signed is fine. If your code has `verify=False` anywhere, that becomes a production incident later.
- **Never hardcode fact sheet IDs.** Mock IDs are UUIDs; real IDs are different UUIDs. Agents must resolve by name/external ID, never by literal.

---

## 1. Authentication (MTM) — mock first, everything depends on it

`POST /services/mtm/v1/oauth2/token`

**Mock:**

| Item | Detail |
|---|---|
| Grant | `grant_type=client_credentials`, HTTP Basic `apitoken:<TOKEN>` |
| Response | `{access_token, token_type: "Bearer", expires_in: 3600, scope}` |
| Token format | **A real, decodable JWT.** Sign with a local key. Include real-shaped claims: `sub`, `exp`, `iat`, `iss`, and `principal.permission.workspaceId` / `workspaceName` / `role` |
| Expiry | Honour `expires_in`. Actually reject expired tokens with `401` |
| Bad creds | `401` with LeanIX-shaped error body |
| Refresh | Your client must exercise its cache-and-refresh path against the mock |

**Why the JWT must be real:** most LeanIX client code reads `workspaceId` out of the decoded token rather than from config. If your mock returns an opaque string, that code path is never tested and breaks on day one.

Also mock `429` with a `Retry-After` header on this endpoint — token minting is rate-limited in production and naive clients that mint per-request will hit it.

---

## 2. GraphQL / Pathfinder — the core, and the hardest to fake well

`POST /services/pathfinder/v1/graphql`

### 2.1 Schema & introspection

This is the single highest-value thing to get right, because AI agents introspect the schema at runtime rather than hardcoding fields.

Mock:

- **Full introspection response** (`__schema`, `__type`) so GraphiQL, codegen and agents all work
- `BaseFactSheet` interface + concrete types requiring inline fragments (`... on Application { ... }`)
- A workspace-specific metamodel with **custom fields**, so your agents are forced to handle the "every workspace is different" reality now rather than later

**Fact sheet types to include:**
`Application`, `ITComponent`, `BusinessCapability`, `Process`, `DataObject`, `Interface`, `Project` / `Initiative`, `Provider`, `TechCategory`, `UserGroup`, `Objective`, `Platform`, and an **AI Agent / AI Model** type (needed for the AI Governance use case).

### 2.2 Queries

| Query | Must support |
|---|---|
| `allFactSheets` | Relay connection: `totalCount`, `edges { node }`, `pageInfo { hasNextPage, endCursor }` |
| | `filter: { facetFilters, fullTextSearch, ids, quickSearch }` |
| | `FacetFilter { facetKey, operator (OR/AND/NOR), keys }` |
| | `sort: [{ key, order, mode }]` |
| `factSheet(id:)` | Single fetch, plus `404`-equivalent error |
| Relations | `rel<Source>To<Target>` returning `{ totalCount, edges { node { id, activeFrom, activeUntil, factSheet {...} } } }` — relation *attributes*, not just targets |
| Nested traversal | 2–3 hops (App → ITComponent → Provider), because dependency-mapping agents do this |
| `allTags`, `allTagGroups` | |
| Subscriptions | `subscriptions { edges { node { user, type, roles } } }` |
| Completion / quality | `completion { completion, percentage }`, `qualitySeal` |
| Lifecycle | `lifecycle { asString, phases { phase, startDate } }` |
| Documents | `documents { edges { node { name, url, origin } } }` |

**Pagination realism matters.** Use opaque base64 cursors, not offsets. Enforce a `first` max (LeanIX caps page size) and a total result ceiling. Agents that assume "one query returns everything" must fail *now*.

### 2.3 Mutations

- `createFactSheet(input:, patches:)`
- `updateFactSheet(id:, patches:, comment:, validateOnly:)` — **JSON-patch style** `[{op: "replace"|"add"|"remove", path, value}]`. This shape is unusual and agents get it wrong; mock it exactly.
- `deleteFactSheet` / archive semantics
- `createTag`, `updateFactSheetTags`
- `createSubscription`, `deleteSubscription`
- `updateFactSheetQualitySeal` (APPROVED / BROKEN / DRAFT)
- `createComment`
- `validateOnly: true` returning validation errors without persisting

### 2.4 Error envelope

Critical and frequently missed: **GraphQL errors come back as HTTP 200** with an `errors` array.

```json
{
  "data": null,
  "errors": [{
    "message": "Field 'foo' not found",
    "locations": [{"line": 3, "column": 5}],
    "path": ["allFactSheets"],
    "extensions": {"code": "VALIDATION_ERROR"}
  }]
}
```

Also mock **partial success**: `data` populated *and* `errors` non-empty. Any agent that only checks `response.ok` will silently ingest nulls in production. Force that bug out now.

---

## 3. REST microservices

LeanIX REST responses use a consistent envelope — mock the wrapper, not just the payload:

```json
{ "status": "OK", "type": "FactSheet", "data": { ... }, "total": 42 }
```

| Service | Path | Mock scope |
|---|---|---|
| **Metamodel** | `/services/pathfinder/v1/models/dataModel`, `/viewModel` | High priority — agents read this to discover types, fields, enums, allowed values |
| **Fact Sheets (REST)** | `/services/pathfinder/v1/factSheets` | CRUD parity with GraphQL |
| **Comments** | `/…/factSheets/{id}/comments` | Threaded, author, timestamps |
| **To-Dos** | `/services/todo/v1` | Create/assign/complete — needed for Stewardship + Governance agents |
| **Surveys** | `/services/survey/v1` | Definitions, runs, invitations, responses, results. Needed for Survey Automation + Stewardship |
| **Poll (legacy)** | `/services/poll/v2` | Stub only unless you have a reason |
| **Metrics / KPIs** | `/services/metrics/v1` | Time-series points & series — needed for TCO, Portfolio Health |
| **Storage** | `/services/storage/v1` | Upload/download, presigned URLs, content-type handling |
| **Synclog** | `/services/synclog/v1` | Run history, errors, lineage — Stewardship agent reads this |
| **Transformations / Impacts** | `/services/transformations`, `/impacts` | Roadmap + scenario agents |
| **Webhooks (mgmt)** | `/services/webhooks/v1/webhooks` | Register/list/update/delete subscriptions |
| **MTM** | `/services/mtm/v1/workspaces`, `/users`, `/permissions` | User lookup, roles, workspace metadata |
| **SCIM** | `/services/scim/v2/Users`, `/Groups` | SCIM 2.0 envelope (`schemas`, `Resources`, `totalResults`) — only if you're doing provisioning |
| **SBOM** | CycloneDX ingest | Only if you're doing the CI/CD or Technical Debt use cases |
| **AI Agent Discovery** | A2A agent-card upload | Needed for the AI Governance agent — and worth mocking, since your own agents are the things being registered |

---

## 4. Integration API (LDIF) — mock the *state machine*, not just the endpoint

This is where naive mocks fail. The real API is **asynchronous**. A mock that returns `200 OK` immediately trains your code into a shape that breaks against the real thing.

| Endpoint | Mock behaviour |
|---|---|
| `POST /synchronizationRuns` | Accept LDIF, validate header (`connectorId`, `connectorType`, `connectorVersion`, `lxVersion`, `processingDirection`, `processingMode`), return a **run ID**, status `IN_PROGRESS` |
| `GET /synchronizationRuns/{id}/status` | Return `IN_PROGRESS` for N polls, then `FINISHED` or `FAILED`. **Make N > 1.** |
| `GET /synchronizationRuns/{id}/results` | Processed/created/updated counts, per-item warnings and errors |
| `POST /synchronizationRuns/withUrlInput` | Fetch-from-URL variant |
| `/configurations` | CRUD on processor configs (`inboundFactSheet`, `inboundRelations`), including validation rejection of malformed processors |
| Error surface | Partial success: 900 records in, 12 rejected, with per-record reasons |

Also mock **outbound/export** LDIF if any use case pulls bulk data out.

> The `leanix-public/integration-api-examples` repo has real LDIF payloads and processor configs. Use those as your fixtures verbatim — it is free fidelity you can get today without a licence.

---

## 5. Webhooks — the mock must **send**, not just receive

Most teams mock the registration endpoint and stop. Then their event-driven agents have never been tested. Your mock needs an event emitter.

**Mock:**

- Actual `HTTP POST` delivery to registered subscriber URLs
- **HMAC-SHA256 signature header** — and your consumer must verify it, or you ship an unauthenticated webhook receiver
- LeanIX payload envelope: event type, workspace ID, user, timestamp, fact sheet ID/type, and the **changed-fields delta**
- Event types: `FactSheetCreatedEvent`, `FactSheetUpdatedEvent`, `FactSheetDeletedEvent`, relation changes, tag changes, subscription changes, quality-seal changes
- **Retry with exponential backoff** on non-2xx, and a dead-letter after N attempts
- **Out-of-order and duplicate delivery** — real webhooks do this; your handlers must be idempotent
- A **manual trigger endpoint** (`POST /_mock/emit`) so you can fire any event on demand in tests
- Automatic emission when a mutation lands, so GraphQL writes produce events like production

---

## 6. MCP server

Mock an MCP server that **proxies to your mock GraphQL**, so data stays consistent across access paths.

**Mock:**

- Transport: streamable HTTP (and stdio if you're testing local clients)
- `initialize`, `tools/list`, `tools/call`, `resources/list`, `prompts/list`
- OAuth flow for the remote transport
- Tools mirroring the documented set: inventory search, get fact sheet, explore relations, run report, quality-seal analysis, architecture guidance
- **Realistic tool result sizes** — including a result large enough to blow a context window, so you build truncation/summarisation now
- Error results (`isError: true`) as well as exceptions

**Deliberately mock the annoying parts:** slow tool calls, tools that return 500 rows, ambiguous natural-language queries returning nothing. Those are your real integration risks, not the happy path.

---

## 7. AI-side capabilities — stub carefully

| Capability | Recommendation |
|---|---|
| **Semantic search** | Implement for real locally — BM25 or a local embedding model over your seed data. A keyword-only stub will make your agents look better than they are. |
| **AI Assistant** (auto-doc, recommendations, survey generation) | Stub with fixed responses. These are LeanIX-side features you consume, not build. |
| **Joule** | Do not mock. Out of scope. |
| **AI-Assisted Automations** | Stub. Not an integration surface. |
| **Your own LLM calls** | **Keep entirely outside the mock server.** Separate abstraction, separate config. Mixing "mock LeanIX" and "mock LLM" into one service is a mess you'll regret. |

---

## 8. Custom Reports SDK host (only if building embedded UI)

If any deliverable runs *inside* LeanIX, mock the iframe host:

- `postMessage` protocol so `lx.init()` resolves with a real-shaped setup object
- `lx.executeGraphQL()` proxied to your mock GraphQL
- Report configuration: facets, view models, config callbacks, `lx.publishState`, `lx.showSpinner`, `lx.openLink`
- Workspace theme/branding + translations
- The `lxr.json` upload/packaging flow

---

## 9. Non-LeanIX systems — from your "Data Sources" sheet

Your use cases need far more than LeanIX. Mock these behind the same swap pattern (base URL + creds in one config layer).

**Required by the recommended pilot 5:**

| System | Needed for | Mock scope |
|---|---|---|
| **ServiceNow CMDB** | Rationalization, Stewardship, Cyber Impact | CI records, relationships, incidents |
| **Apptio / GL / cost feed** | TCO, Licensing, Investment | Cost lines, allocations, currencies, periods |
| **Confluence / SharePoint** | Stewardship, Knowledge Grounding, ADR | Page content, attachments, search |
| **Jira / Jira Align** | Traceability, Roadmap | Issues, epics, projects |
| **Usage telemetry** | Rationalization, Licensing | Logins/MAU per app |
| **Diagramming (Lucid / Signavio)** | Diagram Generation | Create/update diagram, export |

**Second wave:** Tenable/Qualys/CrowdStrike (vuln data), Collibra (data assets), Celonis (process mining), MuleSoft/Boomi (integrations), AD/HR (org structure), Technopedia (lifecycle/EOL dates), AWS/Azure/GCP inventories, Archer (risk).

---

## 10. Cross-cutting behaviours — where mocks usually fall short

These are what make the swap survivable. A mock that only does the happy path is a liability.

| Behaviour | Mock it |
|---|---|
| **Pagination** | Opaque cursors, page-size caps, total-result ceiling |
| **Rate limiting** | `429` + `Retry-After`, per-token quotas, burst limits |
| **Latency** | Configurable injection, p50/p99 profiles. Not instant responses. |
| **Transient failures** | Chaos flag: random `502`/`503`/timeouts at a configurable rate |
| **Eventual consistency** | Write → short delay before the read reflects it |
| **Optimistic locking** | Concurrent-update conflict → `409` |
| **Idempotency** | Duplicate `createFactSheet` → conflict, not silent duplicate |
| **Permissions** | Multiple roles (ADMIN / MEMBER / VIEWER); some writes must be denied. Field-level restrictions. |
| **Multi-workspace** | At least two, so tenant leakage is testable |
| **Archived vs active** | Soft-delete semantics, `status: ARCHIVED` filtering |
| **Quality seal lifecycle** | State machine: DRAFT → APPROVED → BROKEN on edit |
| **Audit log** | Writes generate audit entries the Stewardship agent can read |
| **Deterministic seed** | Fixed random seed → reproducible tests. Plus a bulk generator for volume. |

**Data volume target:** aim for realism, not minimalism. Roughly 500–1,000 Applications, 300 IT Components, 150 Business Capabilities, 200 Projects, 50 Providers, with **intentionally dirty data** — missing owners, stale lifecycle dates, duplicate-ish app names ("SAP ECC" / "ECC 6.0" / "SAP ERP Central"), orphaned relations, null costs. Your Rationalization and Data Quality agents have nothing to do against clean data.

---

## 11. Explicitly do *not* mock

- **SSO / SAML** — stub it; it isn't on your agent path
- **Business logic the real system doesn't have** — if your mock is smarter than LeanIX, you're building on sand
- **The LLM provider** — separate concern, separate abstraction
- **Anything you can't name a use case for** — SCIM, SBOM, Signavio sync are all real APIs, but skip them unless a workflow needs them

---

## 12. Fidelity strategy — how to make the swap actually clean

**Contract-first is the whole trick.** Do not hand-write the mock. Do this instead:

1. **Capture the contract as artifacts you own:** OpenAPI/Swagger specs per service, and a GraphQL SDL file.
2. **Generate both sides from those artifacts** — the mock server *and* your typed client. Then the mock cannot drift from the client's expectations.
3. **Write contract tests** that run against the mock today and against the real workspace on day one. That test suite *is* your cutover checklist.
4. **Build a record/replay mode** now (VCR-style cassettes). When you get a trial workspace, record real traffic and replay it — the mock upgrades from "plausible" to "verified" in an afternoon.

**Free fidelity available today, without a licence:**

- `leanix-public/scripts` — real GraphQL queries and Python examples
- `leanix-public/integration-api-examples` — real LDIF payloads and processor configs
- `leanix/leanix-reporting` — real SDK surface and the `AI_AGENT_GUIDE.md`
- `SAP/leanix-ai-plugins` and `SAP/leanix-self-built-software-agent` — real MCP tool shapes and agent patterns
- Published OpenAPI Explorer specs and the public help.sap.com docs

Harvest response shapes from these into fixtures rather than inventing them.

---

## 13. Suggested build order

| Phase | Scope | Unblocks |
|---|---|---|
| **1** | Config layer + HTTP client + MTM auth + JWT | Everything |
| **2** | GraphQL: introspection, `allFactSheets`, `factSheet`, relations, pagination, error envelope | Most read-side agents |
| **3** | Seed data generator with deliberate dirtiness + metamodel REST | Rationalization, TCO, Data Quality |
| **4** | GraphQL mutations + audit log + quality seal | Stewardship agent |
| **5** | Webhook emitter + HMAC + retries | Event-driven automation |
| **6** | Integration API with async state machine | Bulk sync, Digital Twin |
| **7** | MCP server proxying mock GraphQL | Conversational agents |
| **8** | Surveys, To-Dos, Metrics | Survey Automation, Portfolio Health |
| **9** | External systems (ServiceNow, cost feed, Confluence) | TCO, Cyber Impact, Knowledge Grounding |
| **10** | Chaos, rate limits, latency, permissions | Production readiness |

---

## Reality check on this document

The endpoint paths and response shapes here are drawn from your capability map plus general LeanIX API knowledge. I can't verify them against a live workspace, and SAP has been actively consolidating LeanIX into the BTP/Joule stack, so treat the specific shapes as **approximations to be corrected**, not gospel.

The mitigation is Phase 12 above: get a trial or sandbox workspace as early as you can — even a two-week evaluation — and record real traffic. One afternoon of recorded fixtures is worth more than months of careful guessing.
