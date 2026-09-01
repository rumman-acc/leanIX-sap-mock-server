# LeanIX Mock Server — Use Case Coverage Analysis

**Date:** 31 August 2026
**Method:** Cross-referenced the built mock server (`docs/BUILD_STATUS.md`, actual code under `apps/api`, `apps/mcp`, `packages/prisma`) against `AI-Enabled EA Workflow Use Cases.xlsx` (the pilot-5 agent recommendation, the 30-row use case backlog, and the data-domain source list) and `LeanIX_Mock_Server_Scope.md` (the intended mock surface).

**Scope note:** this repo is the LeanIX mock only. It is not building the agents themselves — those get built on whatever platform the user chooses and will call this mock the same way they'll call real LeanIX later. This document exists so that whoever builds those agents doesn't discover a missing endpoint mid-build; it's a punch list for closing the mock's surface, not a plan for agent code.

---

## 1. Pilot 5 agents (xlsx Sheet 1) — what each needs from the mock, and what's there today

| # | Agent | Needs from LeanIX mock | Status |
|---|-------|------------------------|--------|
| 1 | **Application Rationalization Agent** | `allFactSheets` + relations + facet filters (overlap/redundancy detection), lifecycle dates, tags | ✅ Covered. GraphQL CRUD, relations, pagination all live. |
| 2 | **TCO / Technology Cost Analysis Agent** | Cost data per asset, licensing data | ❌ Not covered — no cost/licensing model exists anywhere in this mock (Metrics API missing; cost is an external-system concern per §9 below, not LeanIX itself) |
| 3 | **Architecture Review Board (Governance) Agent** | Architecture standards/policies to compare against, a way to record review findings, quality seal state changes | ⚠️ Partial. Quality seal is changeable (patch `/qualitySeal` via `updateFactSheet`, confirmed in the live schema — no separate mutation needed). Still missing: no "standard/policy" data shape to check a proposal against, and no way to record a review finding as a first-class object (would have to be jammed into a comment, which also doesn't exist yet). |
| 4 | **EA Repository Stewardship Agent** | Stale-data detection, surveys, comments, audit trail | ❌ Not covered — no Survey API, no Comments API, no audit log. LDIF sync logs exist but that's integration-run history, not a general audit trail on manual edits. |
| 5 | **Architecture Diagram Generation Agent** | Read access to fact sheets + relations (has this), a diagram/export target (Lucid/Signavio — external, not LeanIX) | ✅ Read side covered. Diagram output target is explicitly out of LeanIX's scope, not this mock's problem. |

**Bottom line on the pilot 5:** only agent #1 is fully unblocked today. #5 is unblocked on the LeanIX-read side. #2, #3, #4 will hit missing surfaces on day one of building them.

---

## 2. Full use case backlog (xlsx Sheet 2, 30 rows) — coverage by required surface

Grouping the 30 use cases by what mock surface they actually depend on (not by EA discipline, which is how the sheet groups them):

| Required surface | Use cases that need it | Mock status |
|---|---|---|
| **Fact sheets + relations (GraphQL)** | Strategy-to-Execution Traceability, App-to-Capability Mapping, Rationalization, Capability Heat Mapping, Cloud Migration Planning, Integration Dependency Mapping, M&A Assessment | ✅ Built |
| **Surveys** | EA Repository Stewardship, Architecture Survey Automation | ❌ Not built — `/services/survey/v1` doesn't exist in this repo (scope doc §3 calls it out, never implemented) |
| **Comments / To-Dos** | Stewardship (assign remediation), Governance (route approvals) | ❌ Not built — no Comment or To-Do model in `packages/prisma/schema.prisma`, no `/services/todo/v1` |
| **Metrics/KPIs** | TCO/ROI Analysis, Cost What-If, Portfolio Health Monitoring, Licensing Optimization | ❌ Not built — no `/services/metrics/v1`, no time-series data anywhere |
| **AI Agent/Model fact sheet type + AI Agent Discovery** | AI Governance & Model Traceability, Agentic Asset Classification | ❌ Not built — the seeded meta-model only has the original 9 types (Application, BusinessCapability, ITComponent, Provider, Process, Project, DataObject, Interface, TechnicalStack). `LeanIX_Mock_Server_Scope.md` §2.1 calls for adding an AI Agent/AI Model type; it's still just written down, not implemented. |
| **Data lineage / Synclog as a general concept** | Automated Data Lineage Discovery, EA Repository Stewardship | ⚠️ Partial — `SyncLog`/`SyncRun` exist for LDIF-driven integration runs, but there's no lineage graph or generic audit trail on ad-hoc GraphQL writes |
| **External systems (ServiceNow, Apptio, Confluence, Signavio, Tenable/Qualys, Collibra, etc.)** | Cyber Impact Analysis, Digital Twin Sync, Knowledge Grounding, Value Stream Discovery, TCO, most Scenario Analysis use cases | ❌ None of these exist in this repo at all — see §3 |
| **Architecture standards/policy data + review workflow** | Governance Approval Orchestration, Automated Solution Reviews, Technology Standards Compliance | ❌ No data shape for this exists in the meta-model today |
| **ADR generation inputs (meeting notes, docs)** | Automated ADR | ❌ Out of LeanIX's actual scope — this is a documents/knowledge-base concern (Confluence/SharePoint), not a LeanIX API |

Roughly **7 of 30** use cases are fully unblocked by the mock as it stands today; most of the rest need at least one missing LeanIX-side surface, and several are blocked primarily on external systems rather than LeanIX itself.

---

## 3. External systems (xlsx Sheet 3 / scope doc §9) — a scoping decision, not a gap

`LeanIX_Mock_Server_Scope.md` §9 lists ServiceNow, Apptio, Confluence/SharePoint, Jira, usage telemetry, and Lucid/Signavio as things to mock "behind the same swap pattern." **None of these have been started.** This repo (`leanix-dev-simulator`, per `package.json`) has only ever built the LeanIX surface — that's consistent with the README's stated purpose, but it means the scope doc's §9 is currently aspirational, not implemented.

This matters because roughly half the use case backlog needs one of these systems, not LeanIX. Worth deciding explicitly:
- Do these get mocked in **this repo** (same swap-surface pattern, new sibling services), or
- **A separate repo/mock per external system**, or
- Left for whoever builds the agents to mock themselves against those vendors' own sandboxes.

Not answering this now doesn't block agent #1 (Rationalization) or the LeanIX-read half of #5 (Diagram Generation) — it blocks everything cost- and governance-related.

---

## 4. Concrete punch list, if/when you want to close these

In rough order of how many blocked use cases each unlocks per unit of effort:

1. ~~`updateFactSheetQualitySeal` mutation~~ — **already done**, confirmed live in `leanix.graphql`/`fact-sheet-patch.service.ts` (patch `/qualitySeal` through `updateFactSheet`, also `lxState` DRAFT/APPROVED/BROKEN/REJECTED). Corrected from an earlier stale read of `docs/BUILD_STATUS.md`, which predates this by 3 days of commits.
2. **Comments API** (`/services/pathfinder/v1/factSheets/{id}/comments` + `createComment` mutation) — needs a new `Comment` Prisma model. Small, used by 3+ use cases.
3. **AI Agent/AI Model fact sheet type** — add to `default-meta-model.ts` seed data, same pattern as the other 9 types. Unblocks AI Governance use cases entirely on its own.
4. **To-Dos API** (`/services/todo/v1`) — new model + CRUD controller, same shape as existing controllers.
5. **Surveys API** (`/services/survey/v1`) — the biggest of the missing LeanIX-native surfaces (definitions, runs, invitations, responses, results). Needed for both Stewardship-related use cases.
6. **Metrics/KPIs** (`/services/metrics/v1`) — time-series storage. Needed for TCO/Portfolio Health/Licensing, though those are also blocked on external cost data regardless.
7. **A minimal audit-log model** — every write already has `createdBy`/`updatedBy`/`updatedAt` on `FactSheet`; a dedicated `AuditLog` table capturing before/after per patch would satisfy the Stewardship agent's "detect stale data" workflow without much new plumbing (`updateFactSheet` already goes through one patch service).
8. **External systems decision** (§3 above) — not code, a scoping call.

Items 1–4 are each small (hours, not days) and match the existing code patterns exactly. Items 5–7 are each a full new subsystem, comparable in size to what Webhooks or Integration API already required. Item 8 just needs a decision.

---

## 5. LeanIX-only readiness audit (external systems set aside) — against `LeanIX_Mock_Server_Scope.md` §0–§13 and `LeanIX_Complete_Extensibility_Capability_Map.md`

**Added 31 August 2026**, after re-verifying against the actual current code (not `docs/BUILD_STATUS.md`, which is dated 25 August and is stale — 8 commits and 3 real feature additions have landed since, including the `BaseFactSheet` interface conversion, `facetFilters`, `rev`/`validateOnly`, and `upsertRelation`/`deleteRelation`, none of which BUILD_STATUS mentions).

Question asked: *setting the external systems aside, is the mock complete enough to build any kind of agent against LeanIX itself?* Answer: **no — solid on the read/write core, missing several full subsystems and a few cross-cutting behaviours that specific agent types will need.**

### Solid (verified in code, not just planned)

| Area | Evidence |
|---|---|
| Swap surface / config layer | Confirmed pattern in README + `.env.example` |
| Auth (MTM) | Real HTTP Basic + single API token form implemented, JWT with real claims, exact-match credential validation (no dev- prefix shortcut) |
| GraphQL core | `BaseFactSheet` interface + 9 concrete implementing types (matches real LeanIX's inline-fragment shape), introspection, Relay pagination, real `facetFilters` + facet discovery (`filterOptions`) |
| Mutations | `createFactSheet(input, patches)`, `updateFactSheet(id, rev, patches, comment, validateOnly)`, archive/revive/delete, `upsertRelation`/`deleteRelation` — all matching real LeanIX's confirmed signatures per `docs/RESEARCH_LEANIX_REAL_API.md` |
| Quality seal | `qualitySeal` + `lxState` (DRAFT/APPROVED/BROKEN/REJECTED), changeable via patch |
| Optimistic concurrency | `rev` counter, stale-revision patch is rejected with a clear error |
| Error envelope | HTTP 200 + `errors` array (standard Apollo behaviour, confirmed via `formatGraphQLError`) |
| Role-based write denial | VIEWER blocked from mutations, ADMIN/MEMBER allowed — confirmed in `RolesGuard` |
| Rate limiting | Real Redis sliding-window limiter, `X-RateLimit-*` headers, `Retry-After` on 429 — but see gap below |
| Integration API (LDIF) | Real async state machine (CREATED→RUNNING→FINISHED/FAILED), partial-failure per-row logs, two-pass relation resolution |
| Webhooks | Matches real LeanIX's actual contract (`/services/webhooks/v1/subscriptions`, `identifier`/`targetUrl`/`authorizationHeader`), real HTTP delivery, retry/backoff |
| MCP server | 8 tools, over both stdio (local dev) and a remote Streamable HTTP endpoint matching real LeanIX's actual URL/auth contract (`docs/BUILD_STATUS.md` §7, added 2026-09-01) — usable by any AI Studio/agent-builder platform, not just stdio-capable local clients |
| Archived/trash-bin | Soft-delete + 90-day retention scheduler |

### Missing full subsystems (LeanIX-native, nothing external about them)

| Subsystem | Called for by | Status |
|---|---|---|
| **Comments** | Multiple use cases, governance findings | Not built — no model, no mutation, no REST route |
| **To-Dos** | Stewardship, Governance routing | Not built |
| **Surveys** | Stewardship, Survey Automation | Not built |
| **Metrics/KPIs** | TCO, Portfolio Health, Licensing | Not built |
| **AI Agent/AI Model fact sheet type** | AI Governance use cases | Not seeded — meta-model still only has the original 9 types |
| **AI Agent Discovery (A2A) endpoint** | AI Governance | Not built |
| **Custom Reports SDK host** (scope doc §8) | Any embedded-report deliverable | Not built at all — no iframe/`postMessage` host, no `lx.executeGraphQL()` proxy |
| **Generic audit log** | Stewardship "detect stale data" | Not built — only LDIF sync runs have row-level logs; ad-hoc GraphQL edits leave no separate audit trail beyond `updatedBy`/`updatedAt`/`rev` on the fact sheet itself |

### Cross-cutting behaviours (scope doc §10) — real gaps, agent-shaped

| Behaviour | Status |
|---|---|
| Latency injection / chaos flag (`502`/`503`/timeout at configurable rate) | **Not implemented anywhere** — grepped the whole `apps/api/src` tree, nothing. Any agent's retry/backoff logic will look correct in dev and be unproven going into a real, occasionally-flaky LeanIX. |
| `429` + `Retry-After` on the **token-minting endpoint specifically** | Rate limiting is real but only applies post-auth (it keys off the JWT `user` on the request) — the OAuth token endpoint itself has no rate limit, so a naive client that mints a token per request will never learn not to. |
| Multi-workspace / tenant isolation | **Hardcoded single workspace** (`'ws-development'`, literal string in `fact-sheet.service.ts`, `ldif.processor.ts`, `webhook.service.ts`). There's no second workspace to test tenant leakage against, and the ID is baked in rather than derived from the authenticated user's token — an agent built here has never been forced to pass/scope a workspace ID, which real multi-tenant LeanIX requires. |
| Field-level restrictions (`hidden`/`readOnly` enforcement) | Attributes carry `hidden`/`readOnly` flags in the schema, but the patch service doesn't check them — a patch to a read-only field currently succeeds when it should be rejected. |
| Data volume + intentional dirtiness | Seed data is ~10 named sample fact sheets, not the "500–1,000 Applications... intentionally dirty data" the scope doc calls for. Fine for a smoke-test agent; **not** fine for a Rationalization or Data Quality agent, which have nothing meaningful to do against a dozen clean records. No bulk generator script exists. |
| Record/replay (VCR-style cassettes) | Not built — scope doc §12 flags this as the fastest way to upgrade fidelity once a trial workspace is available; still just an idea. |

### Net answer

If you're building **read-heavy agents against fact sheets/relations/meta-model** (rationalization, mapping, diagram generation, dependency analysis) — the mock is genuinely solid, arguably ahead of what `docs/BUILD_STATUS.md` claims. If an agent needs **surveys, to-dos, comments, metrics, AI-asset governance, or realistic data volume/dirtiness**, or if you want to stress-test an agent's **resilience (latency, chaos, rate limits, multi-tenant isolation)** before it ever sees the real thing, those are still open — not hard, but not done.

## 6. Full backlog verdict — AI agent vs. automation workflow makes no difference to mock sufficiency

**Added 31 August 2026**, in response to: *if I solve all 30 use cases with some mix of AI agents, AI workflows, and plain automation workflows, and leave external systems as-is (not built), is the LeanIX mock enough?*

**The AI-vs-automation distinction is a red herring for this question.** An LLM agent and a deterministic script call the identical LeanIX GraphQL/REST/webhook surface — the mock doesn't know or care which one is on the other end. The one place the distinction *would* matter is if "automation workflow" means LeanIX's own built-in no-code **Automations** engine (When→If→Then, configured inside LeanIX itself, per the capability map §3.1) rather than an external caller. That engine has no documented config API to mock — it's UI/rules-configured inside the real product — so it is **not buildable or testable through this mock at all**, independent of everything else in this document. `LeanIX_Mock_Server_Scope.md` §7 already excludes it explicitly ("AI-Assisted Automations — stub, not an integration surface"; "Joule — do not mock, out of scope"). If any of the 30 use cases is meant to be delivered as a native LeanIX Automation rather than an external agent/script, this repo cannot help you develop it either way, license or no license.

For everything built as an **external** agent/workflow/automation (the normal case), here's the honest split of the ~30-row backlog, external systems set aside as requested:

| Tier | Meaning | Use cases | Count |
|---|---|---|---|
| **A — Ready now** | LeanIX mock alone is sufficient, no new subsystem needed | AI-Assisted Data Quality, Application-to-Capability Mapping, Application Rationalization (structural: overlap/duplicate/redundancy detection off fact sheets + relations, without cost/usage data) | ~3 |
| **B — Blocked on a missing *LeanIX-native* subsystem** | Fixable inside this mock, no external system needed — the punch list from §4 | EA Repository Stewardship, Architecture Survey Automation (→ Surveys), AI Governance & Model Traceability (→ AI Agent/Model type + Discovery), Governance Approval Orchestration, Automated Solution Reviews, Technology Standards Compliance (→ standards/policy data shape + Comments/To-Dos), Strategy-to-Execution Traceability, Capability-Based Roadmap Generation (→ Objective fact sheet type isn't seeded), **M&A Architecture Assessment (→ needs a second workspace to compare portfolios against — blocked specifically by the hardcoded single-workspace gap in §5)** | ~9 |
| **C — Blocked on external systems, regardless of how complete the LeanIX mock gets** | No amount of LeanIX-mock work unblocks these; the essential data (cost, vulnerabilities, usage telemetry, code quality, process models, documents) doesn't live in LeanIX at all, mock or real | Enterprise Knowledge Grounding, Value Stream Discovery, Automated Data Lineage Discovery, Integration Dependency Mapping, Cloud Migration Planning, Cost What-If Analysis, Cyber Impact & Dependency Analysis, Digital Twin Synchronization, Automated ADR Generation, Technology TCO & ROI Analysis, Licensing Optimization, Technology Obsolescence Management, Application Portfolio Health Monitoring, Technical Debt Management, Technology Investment Optimization, Agentic Asset Classification, AI Data Normalization, most of Business Capability Heat Mapping (investment data), most of Architecture Artifact Refresh/Diagram Generation (CMDB/code bases beyond the LeanIX-read half) | ~15–17 |

**Direct answer: no, the LeanIX mock — however complete you make it — cannot make tier C solvable on its own.** That's roughly half the backlog. It's not a mock-completeness problem, it's a data-source problem: those use cases are fundamentally about cost, security, usage, or process data that LeanIX (real or mocked) was never the system of record for. Closing tier B (the §4 punch list, ~9 use cases, all small-to-medium LeanIX-side work) gets you from ~3/30 to ~12/30 fully unblocked. Getting the rest requires standing up at least one external mock (ServiceNow and/or a cost feed unlock the largest chunk of tier C) — which is the decision flagged and deliberately left open in §3.

## 7. Tier-B closure (31 August 2026) — what actually got built

All 6 planned phases landed, live-verified, and covered by tests (unit + e2e). Full detail in `docs/BUILD_STATUS.md`'s "Tier-B closure" section; summary here:

| Phase | What shipped | Tier-B items closed |
|---|---|---|
| 1 | Comments (`Comment` model, REST `factSheets/{id}/comments`, GraphQL `createComment` + `comments` field on every fact sheet type) | Comments |
| 2 | To-Dos (`Todo` model, REST `/services/todo/v1` full CRUD + complete) | To-Dos |
| 3 | `TechCategory` (with a `standardStatus` field — modeled through the existing generic attribute mechanism, not a new invented subsystem) and `Objective` fact sheet types, plus 4 new relation types wiring them into the existing graph | Standards/policy data shape, Strategy-to-Execution Traceability, Capability-Based Roadmap Generation, Technology Standards Compliance |
| 4 | `AIAgent` fact sheet type + `POST /services/aiagent/v1/discovery` (upserts an agent card as an `AIAgent` fact sheet, reusing `FactSheetService`/`FactSheetPatchService` rather than a parallel write path) | AI Governance & Model Traceability, Agentic Asset Classification |
| 5 | Surveys (`SurveyDefinition`/`SurveyRun`/`SurveyInvitation`/`SurveyResponse`, REST `/services/survey/v1` — definitions, runs, invitations, responses, results) | Architecture Survey Automation, EA Repository Stewardship's survey half |
| 6 | Real multi-workspace scoping — `workspaceId` added to `FactSheetType`/`RelationType`/`FactSheet`/`TagGroup` (composite unique constraints), every read/write path threaded with the authenticated actor's workspace, a second seeded workspace (`ws-acquired-co`) with its own meta model and a portfolio that overlaps by *name* with `ws-development`'s | M&A Architecture Assessment — genuinely testable now, not just unblocked in theory: cross-workspace reads return null, cross-workspace relation writes are rejected, two independently-authenticated tokens see two different portfolios |

Tier B in §6's table is now fully closed (9/9). Net effect on the full backlog: **12/30 → this doesn't change** the tier-C count (external-system-gated use cases are still gated the same way), but every use case that was blocked purely on a missing LeanIX-native piece is now unblocked.

**Two real infrastructure bugs found and fixed along the way** (not part of the plan, found live-verifying it):
1. `main.ts`'s global `ValidationPipe` had `whitelist: true` set, which — combined with this repo's deliberate house style of undecorated, Swagger-only REST DTOs (see docs/BUILD_STATUS.md) — silently stripped every field from every POST/PUT/PATCH request body. This broke the *already-shipped* webhook registration endpoint too, meaning it had been broken since whatever commit added that pipe option, undetected because nothing had re-tested it since. Fixed by dropping `whitelist`.
2. `prisma migrate dev`/`deploy`, run against this project's only configured `DATABASE_URL` (Neon's PgBouncer-pooled endpoint, `pgbouncer=true`), applies DDL successfully but never durably records it in `_prisma_migrations` — every migration in this session had actually been running "blind" until this was caught (mid multi-workspace migration, `prisma migrate status` reported all 6 migrations as unapplied despite 5 of them being live in the schema). Prisma's own docs say migrations need a direct, non-pooled connection; this project's `.env` only has the pooled one. Worked around per-migration by resolving history against Neon's direct hostname; the durable fix (a separate `DIRECT_DATABASE_URL` used only by migration commands) is noted but not yet made permanent — worth doing before the next migration.

## Reality check

This is a coverage audit against a spreadsheet of *planned* use cases, not a verified requirements doc from whoever's building the agents. Some of these 30 use cases may never get built, and the agents that do get built may need things this analysis didn't anticipate (the xlsx describes workflow *steps*, not API calls). Treat the punch list as "what's clearly missing if you build these specific use cases," not "build all of this before starting."
