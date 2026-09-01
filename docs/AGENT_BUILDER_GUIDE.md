# Building an Agent Against This Mock — Complete Guide

One document that ties together every service this mock exposes, how to authenticate to each, and which one to reach for depending on what you're building. `docs/API_REFERENCE.md` has the exhaustive field-by-field detail for each service; this doc is the map that gets you there.

**The promise this repo is built on:** build your agent against this mock now; later, swap `LEANIX_BASE_URL` + credentials for a real licensed LeanIX workspace and (mostly) nothing else changes. The "What's mock-only" section at the end lists the specific exceptions.

---

## 1. Base URLs

| Environment | URL |
|---|---|
| Local | `http://localhost:4000` |
| Deployed (Render, free tier — cold-starts after inactivity) | `https://leanix-mock-api.onrender.com` |

Interactive exploration: Swagger UI at `/api-docs`, GraphQL Playground at `/services/pathfinder/v1/graphql` (open either in a browser).

---

## 2. Get a token first — everything needs one

```bash
curl -u apitoken:dev-token-12345 --data grant_type=client_credentials \
  https://leanix-mock-api.onrender.com/services/mtm/v1/oauth2/token
```
→ `{ "access_token": "<jwt>", "expires_in": 3600, ... }`. Cache it, refresh before it expires — don't mint one per request.

Two seeded workspaces to authenticate into (see §7 — this matters more than it looks):

| Workspace | Token | Use for |
|---|---|---|
| `ws-development` | `dev-token-12345` | the default portfolio |
| `ws-acquired-co` | `dev-token-acquired-11111` | testing cross-tenant logic (M&A-style) — a portfolio that overlaps by name, not id, with `ws-development`'s |

---

## 3. Pick your integration surface

| You're building... | Use | Why |
|---|---|---|
| An LLM agent with tool-calling (Claude, any MCP-capable agent builder) | **MCP — remote Streamable HTTP** (§5) | Zero custom integration code — point your agent platform's MCP client config at the URL + header, done. This is also the one that matches real LeanIX's actual MCP contract, so it's what survives the swap. |
| An LLM agent, but your platform only spawns local subprocesses (Claude Desktop) | **MCP — stdio** (§5) | Same 8 tools, local process instead of a URL. Real LeanIX has no stdio equivalent — read this as a dev convenience, not something to design agent logic around long-term. |
| Anything reading/writing fact sheets, relations, or the meta model directly — not going through an LLM | **GraphQL** (§4) | The actual system of record. MCP tools are themselves just a thin wrapper over this. |
| Deterministic automation (a script, a cron job, a webhook-triggered handler) | **GraphQL + REST subsystems directly** (§4/§6), no MCP | MCP is an LLM-facing convenience layer; a script doesn't need it, just call the APIs. |

---

## 4. GraphQL — the core

`POST /services/pathfinder/v1/graphql`. This is where fact sheet CRUD, relations, and meta-model discovery live — not REST.

```graphql
query { allFactSheets(filter: { facetFilters: [{ facetKey: "FactSheetTypes", keys: ["Application"] }] }, first: 20) {
  totalCount edges { node { id name qualitySeal comments { message } } }
} }
```

12 fact sheet types: the original 9 (`Application`, `BusinessCapability`, `ITComponent`, `Provider`, `Process`, `Project`, `DataObject`, `Interface`, `TechnicalStack`) plus 3 for governance use cases — `TechCategory` (standards status), `Objective` (strategy/OKR traceability), `AIAgent` (AI governance).

Mutations: `createFactSheet`, `updateFactSheet` (JSON-patch style — see API_REFERENCE.md's patch-path table), `archiveFactSheet`, `reviveFactSheet`, `deleteFactSheet`, `upsertRelation`, `deleteRelation`, `createComment`.

**Full detail (patch paths, filtering syntax, field list):** `docs/API_REFERENCE.md` §GraphQL.

---

## 5. MCP — for LLM/agent tool-calling

### Remote (build against this one)

```
POST https://leanix-mock-api.onrender.com/services/mcp-server/v1/mcp?toolsets=inventory
Authorization: Token dev-token-12345
```

Streamable HTTP, stateless (fresh server per request — no session to manage). Matches real LeanIX's actual contract (verified against SAP's own docs): same URL shape, same `Token`/`Bearer` auth, same `?toolsets=` gating.

Example client config:
```json
{ "mcpServers": { "leanix-mock": {
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://leanix-mock-api.onrender.com/services/mcp-server/v1/mcp?toolsets=inventory", "--header", "Authorization: Token dev-token-12345"]
} } }
```
Most agent-builder platforms take the URL + header directly without needing the `mcp-remote` shim — that's specifically for stdio-only clients like Claude Desktop bridging to a remote server.

### Local stdio (Claude Desktop, or anything that spawns a subprocess)

```bash
npm run build --workspace=apps/mcp
LEANIX_BASE_URL=http://localhost:4000 LEANIX_API_TOKEN=dev-token-12345 LEANIX_API_TOKEN_SECRET=dev-secret-67890 \
node apps/mcp/dist/server.js
```

### The 8 tools (same set, either transport)

`search_fact_sheets`, `get_fact_sheet`, `get_relations`, `create_fact_sheet`, `update_fact_sheet`, `get_meta_model`, `get_reports`, `explain_architecture`.

---

## 6. REST subsystems

Full request/response shapes for all of these are in Swagger UI at `/api-docs` — this table is the index.

| Subsystem | Base path | Needed for |
|---|---|---|
| **Comments** | `/services/pathfinder/v1/factSheets/{id}/comments` | Governance findings, stewardship notes |
| **To-Dos** | `/services/todo/v1` | Assigning remediation, governance routing |
| **Surveys** | `/services/survey/v1` | Architecture Survey Automation, EA Repository Stewardship |
| **AI Agent Discovery** | `/services/aiagent/v1/discovery` | Registering an AI agent as an `AIAgent` fact sheet — AI governance use cases |
| **Integration API (LDIF)** | `/services/integration-api/v1` | Bulk sync, ETL from external systems into the fact sheet graph |
| **Webhooks** | `/services/webhooks/v1/subscriptions` | Event-driven automation — get pinged on fact sheet changes instead of polling |
| **Auth (MTM)** | `/services/mtm/v1/oauth2/token` | §2 above |

---

## 7. Workspaces — read this before building anything cross-tenant

Every fact sheet, relation type, and meta-model definition is scoped to whichever workspace your token belongs to. A token from `ws-development` reading a `ws-acquired-co` fact sheet by id gets `null`, not an error with details — same as real LeanIX. Two fact sheet types with the same `technicalKey` in different workspaces have **different ids** — always resolve by `technicalKey` at runtime, never hardcode a type/relation-type id.

Comments/To-Dos/Surveys are **not** workspace-scoped yet (they trust whatever `factSheetId` they're given) — documented gap, see `LeanIX_Mock_UseCase_Coverage_Analysis.md` §6.

---

## 8. Sample data — what's actually there to query

Seeded by `packages/prisma/seed.ts` (`npm run prisma:seed`). Small on purpose — enough to exercise relations/filtering/cross-workspace logic, not a realistic-volume dataset (no bulk generator exists yet, see `LeanIX_Mock_UseCase_Coverage_Analysis.md` §5).

**`ws-development`** — 11 fact sheets, 10 relations, 1 tag, 1 subscription:

| Type | Name(s) |
|---|---|
| Application | SAP CRM, Salesforce, E-Commerce Platform |
| ITComponent | AWS EC2 Instance, PostgreSQL Database |
| BusinessCapability | Sales Management |
| Provider | Amazon Web Services |
| TechCategory | Approved Cloud Providers, Deprecated Frameworks |
| Objective | Grow Digital Revenue |
| AIAgent | EA Copilot |

**`ws-acquired-co`** — 5 fact sheets, 2 relations, deliberately overlapping *by name* with the above (for M&A/cross-tenant testing — see §7):

| Type | Name(s) |
|---|---|
| Application | SAP Customer 360, Online Store, Workday HR |
| ITComponent | Azure VM |
| Provider | Microsoft Azure |

**Zero seed data**: Comments, To-Dos, Surveys, AI Agent Discovery entries. These subsystems are fully built and tested but not pre-populated — your agent (or you, manually) has to create records via the API before there's anything to read back. Don't assume a comment/to-do/survey exists just because you saw one during earlier testing — that's incidental data from live-verifying the endpoints, not part of the seed.

---

## 9. Mapping to actual use cases

The full 30-use-case backlog and what's ready today: `LeanIX_Mock_UseCase_Coverage_Analysis.md`. Short version:

- **Fully ready** (GraphQL + relations alone): Application Rationalization (structural), Application-to-Capability Mapping, AI-Assisted Data Quality, M&A Architecture Assessment (needs both workspaces, §7).
- **Ready with the newer subsystems**: AI Governance (§6 AI Agent Discovery + `AIAgent` type), Technology Standards Compliance (`TechCategory` + `standardStatus`), Strategy-to-Execution Traceability (`Objective` type), EA Repository Stewardship / Survey Automation (§6 Surveys).
- **Blocked regardless of this mock** (need external systems — ServiceNow, Apptio, etc., not built here): TCO, Cyber Impact, Licensing Optimization, Technical Debt Management, and roughly half the backlog. Building these requires either those systems' own sandboxes or a decision to mock them here too — not yet made.

---

## 10. What's mock-only — don't design agent logic around these surviving the swap

- Webhook `events`/`secret`/HMAC signing, and the mock-only OAuth `client_id`/`client_secret` form
- `TechCategory`/`Objective`/`AIAgent` types and their custom fields — plausible, not verified against a real workspace
- The AI Agent Discovery endpoint's exact request shape (best-effort)
- MCP's `Bearer <raw-token>` fallback and `?toolsets=` omitted-defaults-to-`inventory` — both mock-only leniencies
- The local stdio MCP path — no real-LeanIX equivalent at all

Full citations for what *is* verified real: `docs/RESEARCH_LEANIX_REAL_API.md`.
