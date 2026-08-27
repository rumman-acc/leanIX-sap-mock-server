# Research: Real LeanIX API vs. This Mock

**Purpose:** find where this mock (built against `LeanIX_Mock_Server_Technical_Specification.md`) actually diverges from real SAP LeanIX behavior, since the goal is a domain-only swap. No real LeanIX license was available to verify against directly — this is built from public SAP/LeanIX documentation, the official `leanix-reporting` SDK repo, the `codecentric/terraform-provider-leanix` (a real, actively-maintained client of LeanIX's REST API — its Go structs are effectively ground truth for wire format), and LeanIX's own developer community forum.

**Headline finding:** the original technical spec doc, despite its own "Validated against official SAP LeanIX documentation" claim, contains several concrete, sourced inaccuracies relative to real LeanIX — not just simplifications. Three are significant enough to require a decision before implementing (see §1-3 below); the rest are smaller field/naming corrections (§4+).

Confidence key: **HIGH** = seen in an official SAP doc, a real client SDK's source, or a directly-quoted example. **MEDIUM** = search-engine-summarized secondary source, not directly verified. **LOW** = inferred/plausible, not confirmed.

---

## 1. OAuth token flow — real LeanIX uses ONE token via HTTP Basic auth, not client_id/secret in the body

**Confidence: HIGH** — real documented curl example:
```bash
curl --request POST --url https://<host>.leanix.net/services/mtm/v1/oauth2/token \
  -u apitoken:<API_TOKEN> --data grant_type=client_credentials
```
Source: LeanIX developer docs / community threads (`docs.leantech.me/docs/authentication`, `docs-vsm.leanix.net/reference/authentication`).

- Auth is **HTTP Basic**, username literally `apitoken`, password = the single API Token value (generated once per technical user in the workspace admin panel).
- There is **no `client_secret`** — LeanIX's real technical-user model has one token, not a token+secret pair.
- The endpoint path (`/services/mtm/v1/oauth2/token`) and `grant_type=client_credentials` do match what this mock implements — only the credential transport differs.

**What this mock does instead** (per the original spec's section 4.2, which specified `client_id`/`client_secret` as form body fields): accepts `client_id`/`client_secret` in the POST body, two separate values. This is a real, concrete mismatch — a custom application built against this mock's current auth contract would break immediately against real LeanIX, needing a code change to switch to HTTP Basic with a single token. **This directly defeats the domain-only-swap goal.**

## 2. Webhook API — completely different endpoint, contract, and underlying model

**Confidence: HIGH** — sourced from `codecentric/terraform-provider-leanix`'s `resource_leanix_webhook_subscription.go` (a real, working LeanIX API client) plus a directly-quoted endpoint from search results.

- **Real endpoint:** `POST https://{subdomain}.leanix.net/services/webhooks/v1/subscriptions` — plural `webhooks`, `subscriptions`, not this mock's `/services/webhook/v1/webhooks`.
- **Real request body fields:** `identifier`, `targetUrl`, `targetMethod`, `authorizationHeader`, `workspaceId`, `callback`, `workspaceConstraint` (default `"ANY"`), `payloadMode` (default `"DEFAULT"`), `active`, `ignoreError`, `tagSets`. Response includes `id` and `deliveryType` (always `"PUSH"`).
- **No `events: [...]` array, no `secret` field, no HMAC-SHA256 signature scheme.** Instead: `authorizationHeader` is a static header value LeanIX sends with every delivery (like a bearer token you provide), not a signing secret to verify against. Delivery targeting/filtering is done via `identifier` + `tagSets`, not a list of event-type strings.
- Real LeanIX's webhook system appears to be built on top of a broader **"Automations"** feature (see "Creating an Automation with a Webhook Action" in the docs) — a webhook subscription is one action type an Automation can trigger, not a standalone simple pub-sub registration. This is a materially different architecture, not just different field names.

**What this mock does instead** (per the original spec's section 10 and Appendix C): `POST /services/webhook/v1/webhooks` with `{url, events, secret}`, HMAC-SHA256 signed deliveries with `X-LeanIX-Event`/`X-LeanIX-Delivery`/`X-LeanIX-Signature` headers. **This entire subsystem was built to a contract that doesn't match real LeanIX.** A custom application integrating against this mock's webhook API today would need a full rewrite of its webhook registration/signature-verification code to work against real LeanIX.

## 3. GraphQL fact sheet filtering — real LeanIX uses `facetFilters`, not `fieldFilters`

**Confidence: HIGH** — directly-quoted real query from a LeanIX community support thread:
```graphql
query MyQuery {
  allFactSheets(filter: {
    facetFilters: [
      { facetKey: "FactSheetTypes", operator: OR, keys: ["ITComponent"] }
      { facetKey: "category", operator: OR, keys: ["service"] }
      { facetKey: "_TAGS_", operator: OR, keys: ["16d475fb-..."] }
    ]
  }) { edges { node { id name } } }
}
```
Plus a facet-discovery query that has no equivalent in this mock at all:
```graphql
{ allFactSheets { filterOptions { facets { facetKey results { name key } } } } }
```

- Real filtering is **facet-based**: `facetKey` (a string key — `"FactSheetTypes"`, `"category"`, `"_TAGS_"`, or a custom attribute's technical key) + `operator` (`OR`/`AND`, not `EQUALS`/`CONTAINS`/etc.) + `keys` (plural, an array of facet values — e.g. tag *ids*, not names). There's no separate top-level `factSheetType`/`status` filter field — fact sheet type itself is just another facet (`facetKey: "FactSheetTypes"`).
- `edges`/`node`/Relay pagination shape does match this mock — that part of the original spec's Appendix A was accurate.

**What this mock does instead:** `FilterInput { factSheetType, status, fieldFilters: [{key, values, operator}], relationFilters }` — a hand-rolled filter shape, not the real facet model. A custom app's real LeanIX filter queries (built the facet way) simply wouldn't parse against this mock's schema — GraphQL would reject them at validation time before they even reached a resolver.

---

## 4. Smaller, more contained corrections — ALL FIXED (2026-08-26)

- **`updateFactSheet` patch paths for real fields differed from what this mock accepted**, per directly-quoted real examples — all now fixed, live-verified, unit-tested:
  - Lifecycle: `{"op":"replace","path":"/lifecycle/phaseIn","value":"2022-07-01"}` — real LeanIX patches **one phase at a time** by its phase name in the path (`/lifecycle/plan`, `/lifecycle/phaseIn`, `/lifecycle/active`, ...). **Fixed**: `/lifecycle/{phaseName}` now supported (preserves other phases); the whole-object `/lifecycle` replace also now accepts real LeanIX's form — a JSON-encoded **string** value, not just an inline object. Also found and fixed a related bug this surfaced: `LifecyclePhase.startDate` was typed GraphQL `DateTime` (strict ISO datetime), which rejected the date-only strings (`"2022-07-01"`) both real LeanIX and this mock's own seed data actually use — changed to `String`.
  - `externalId`: `{"op":"replace","path":"/externalId","value":"{\"type\":\"ExternalId\",\"externalId\":\"123456789\"}"}` — real `externalId` is a **structured object** (`{type, externalId}`). **Fixed** on the write path: the patch handler unwraps the structured form to the plain string this mock stores internally; a plain string is still also accepted (mock convenience). **Not fully replicated**: the mock's internal storage/uniqueness constraint and GraphQL *read* type remain a plain string — full multi-external-id-per-fact-sheet support (multiple `{type, externalId}` pairs per fact sheet) is NOT implemented, since real LeanIX's exact semantics for multiple external ID "types" per fact sheet weren't confirmed.
  - `qualitySeal` is directly patchable: `{"op":"replace","path":"/qualitySeal","value":"approve"}` — note **lowercase** `"approve"`, not this mock's uppercase `APPROVED` enum value; this mock never exposed a patch path for it at all before. **Fixed**: `/qualitySeal` now accepts both the real lowercase form and this mock's uppercase enum form.
  - A real response example includes a `lxState` field (`factSheet { id name lxState }`). Follow-up search clarified (**MEDIUM confidence** — search-engine-synthesized, not a directly quoted raw doc): `lxState` is real LeanIX's field for **quality-seal state**, distinct from `status` (archived/active) — values `"APPROVED"` / `"BROKEN_QUALITY_SEAL"` (note: different casing/spelling than the `qualitySeal` patch value `"approve"`/`"broken"` — plausible real-world API quirk where the write path and the read/facet field differ, not fully reconciled). **Fixed**: added `lxState: String!` as a read-only field on `FactSheet`, derived from `qualitySeal` (`APPROVED`→`"APPROVED"`, `BROKEN`→`"BROKEN_QUALITY_SEAL"`).
- **Meta model allowed values are genuinely workspace-specific and not part of any fixed public spec** (confirmed via the official `leanix-reporting` SDK's `AI_AGENT_GUIDE.md`: *"Enum fields ... have workspace-specific values that cannot be assumed. Always retrieve values dynamically from field metadata."*). This actually **validates** this mock's existing approach (exposing allowed values via `allFactSheetTypes.fields.allowedValues` through the meta model API) — no code change needed here, just confirms the current design choice was right.
- Real REST also appears to expose fact-sheet-adjacent endpoints under `services/pathfinder/v1/...` beyond just GraphQL (a search snippet referenced `services/pathfinder/v1/factSheets`) — **MEDIUM confidence, not verified with a real response shape**. Flagging as an open question rather than acting on it.

---

## 5. Cross-checked against LeanIX's own official example repo (2026-08-26)

Source: `github.com/leanix-public/integration-api-examples` (LeanIX's own public GitHub org, real `config.json`/`input.json` files used in their integration workshop) — the highest-confidence source available short of a real license, since these are files LeanIX itself publishes as working examples.

- **`businessCriticality` allowed values — HIGH confidence, FIXED.** The placeholder values in §4/original spec-guessing were wrong. Real values, straight from an official value-mapping table in the workshop's README: `missionCritical`, `businessCritical`, `businessOperational`, `administrativeService`. Updated `packages/shared/src/constants/default-meta-model.ts`; `packages/prisma/seed.ts` now also deletes stale allowed values no longer in the definition on reseed (it previously only ever added, never cleaned up).
- **`functionalSuitability`/`technicalSuitability` — still placeholders, deliberately not changed.** A search surfaced candidate values (`unreasonable`/`insufficient`/`appropriate`/`perfect` and `inappropriate`/`unreasonable`/`adequate`/`fullyAppropriate`) but only from blog-post prose describing the *concept*, not a real config file like the businessCriticality one — LOW confidence, and the SDK's own docs already say these are workspace-specific and shouldn't be assumed (see §4). Left as illustrative placeholders rather than replacing correct-looking-but-unverified guesses with different-looking-but-still-unverified guesses.
- **Real `inboundFactSheet` processor/config.json shape confirmed, materially different from the original spec's example** — but NOT implemented, a deliberate scope decision:
  - Real: `identifier.external.id.expr = "${content.id}"` (matches on the LDIF content item's own `id`, not a `data.externalId` field), `identifier.external.type.expr = "externalId"` (a literal constant naming the identifier *type*, not a template — this is the same `"type"` value that shows up in the structured `externalId` object from §4: `{"type":"ExternalId","externalId":"..."}`) — no `key`/`value` pair split like the original spec assumed, just `expr`.
  - Real: `filter: { type: "Application" }` — scopes which content items a processor applies to; not present in our config storage at all.
  - Real: `updates: [{ key: { expr: "name" }, values: [{ expr: "${data.name}" }] }]` — one array entry per target field, `key.expr` is the literal field name, `values` is an array of expressions (supports value-mapping/fallback chains) — structurally different from the original spec's nested `key`+`values[].key` shape.
  - Real: `logLevel: "warning"` (lowercase), not `"WARNING"`.
  - **This mock stores `processors` as opaque JSON and never interprets it** — actual sync-run processing (`ldif.processor.ts`) does its own simpler 1:1 `data.<key>` → fact sheet field mapping, which happens to produce identical results to the real processor's `${data.name}` → `name` expression for the common case (verified: the real `BasicConnector-CreateApplications_and_relations` example's `updates` block does nothing more than what our direct mapping already does). Building a real expression-evaluation engine (parsing `${content.id}`, `${data.x}`, value-mapping tables) to properly interpret arbitrary processor configs is a materially bigger feature than anything else fixed this session — not attempted. The Swagger example for `POST .../configurations` now shows the *real* shape (for accuracy/documentation), even though this mock doesn't act on it.
  - Also confirmed real LDIF payloads include a top-level `customFields: {}` object not in the original spec — added to the `LDIF` type as an accepted-and-ignored passthrough field (no confirmed real semantics to replicate).

## 6. Validated against an external "spec validation analysis" document (2026-08-27)

User provided `LeanIX_Mock_Spec_Validation_Analysis.md` (their own review of ChatGPT/Gemini feedback against the original spec) and asked me to independently validate it, since it flagged its own uncertainty in several places (it claims some SAP Help Portal pages were unreadable JS/SVG shells while claiming clean extracted content from others — an internal inconsistency worth distrusting). Re-verified every claim against primary sources directly (not the document's summary) — fetched raw `github.com/leanix/leanix-reporting/AI_AGENT_GUIDE.md` and cross-checked via DeepWiki/search.

**Confirmed TRUE, HIGH confidence (direct quotes from LeanIX's own official SDK guide) — FIXED, live-verified:**
- **`BaseFactSheet` interface + inline fragments are real**: *"All fact sheet types extend the GraphQL interface `BaseFactSheet`, which defines the common fields: id, name, displayName, and type."* Relation targets return `BaseFactSheet`; concrete-type fields need `... on Application { businessCriticality }`. This directly contradicts the flat-`FactSheet`-type simplification chosen in Phase 1 (following "Appendix A is canonical" literally) — see §7 below for the fix.
- **`lxState` has 4 values, not 2**: `APPROVED`, `BROKEN_QUALITY_SEAL`, `DRAFT`, `REJECTED` (quoted directly, also used as a facet filter value). Fixed: `QualitySeal` enum now has all 4 (was `BROKEN`/`APPROVED` only); `/qualitySeal` patch accepts `DRAFT`/`REJECTED`/`reject` too.
- **`upsertRelation`/`deleteRelation` are real dedicated mutations** (quoted from example code comments). Fixed: added both as GraphQL mutations, alongside the existing (still fully supported) patch-based relation management on `updateFactSheet`. Real argument names beyond "from, to, type" weren't confirmed — best-effort naming (`from: ID!, to: ID!, type: String!, description: String`).
- **`updateFactSheet`'s real signature includes `rev`** (optimistic-concurrency revision number), plus optional `comment` and `validateOnly` — found via a second independent source (DeepWiki extraction), not in the original analysis document. Fixed: added `rev: Int!` field to `FactSheet` (increments on every write — create/patch/archive/revive/LDIF update/relation change), `updateFactSheet(rev: Int, ...)` rejects a stale `rev` with `INVALID_PATCH`; `comment: String` accepted but not persisted (no confirmed storage semantics); `validateOnly: Boolean` runs every patch's validation inside the transaction then intentionally rolls back, returning the fact sheet unchanged.

**Corroborated, medium-high confidence — FIXED:**
- **`createFactSheet(input, patches)` accepting both simultaneously** — confirmed by 2 independent secondary sources. Fixed: `createFactSheet` now takes an optional `patches: [Patch!]` argument, applied right after creation via the same (already-tested) patch logic `updateFactSheet` uses — no duplicated business logic.

**Could NOT verify — explicitly NOT acted on:**
- `completion` as `{percentage: Float}` object vs. this mock's plain `Float` — no source gave a clean confirmed schema quote (one ambiguous community snippet, DeepWiki couldn't confirm either way).
- `permissions {create, read, update, delete, self}` — zero corroboration found anywhere.
- `FACT_SHEET_DELETED` webhook event, exact webhook payload shape, PascalCase event naming — the analysis document itself already correctly flags these as unverified; nothing found here changes that.

**Real bug found and fixed while implementing `upsertRelation`**: the initial implementation did a deep nested read (source + target's full field-resolver data) *inside* the database transaction alongside the write — live-testing against Neon, this blew past the 20s interactive-transaction timeout. Fixed by moving the heavy reads outside the transaction (matching the pattern already used everywhere else in the codebase) — the transaction now only does the lightweight write.

All of the above live-verified via curl against the running server + Neon, plus new tests (4 unit, 1 large e2e covering all five features in sequence). Full suite: 50/50 (35 unit + 15 e2e).

## 7. `BaseFactSheet` interface + inline fragments — in progress

The confirmed-real biggest architectural gap from §6. Not yet implemented as of this write-up — see the next commit(s) for the schema conversion (concrete per-type GraphQL types implementing a `BaseFactSheet` interface, `__resolveType`, inline-fragment support).

## What wasn't re-verified in this pass (out of scope / lower priority given time)

- Full real GraphQL SDL (types, all fields) — not obtainable without workspace access (GraphiQL requires admin login to a real workspace); relied on quoted example queries instead of the full schema.
- Application Portfolio Assessment / Architecture Executive Dashboard backing APIs (flagged as a gap in an earlier conversation) — not revisited here; still unconfirmed whether/how these are backed by dedicated API objects vs. built entirely on the standard Fact Sheet + facet-filter APIs above.
- Rate limit exact numbers, error code taxonomy beyond generic GraphQL `extensions.code` shape, LDIF/Integration API real contract — not directly re-verified against a real source this pass; this mock's existing behavior here came from the original spec and wasn't specifically contradicted by anything found.

---

## Recommendation

§1-3 are the ones that matter for "only change the domain" to actually hold — they're not stylistic, they're contract-breaking. Fixing them means:
1. **Auth**: switch the token endpoint to accept HTTP Basic (`apitoken:<token>`) instead of/in addition to `client_id`/`client_secret`, and simplify the credential model to a single token per technical user.
2. **Webhooks**: this is a bigger one — effectively rebuild the subsystem's contract (endpoint path, request/response fields, delivery mechanism) to match the real `identifier`/`targetUrl`/`targetMethod`/`authorizationHeader` model instead of the current `url`/`events`/`secret`+HMAC model. This also means dropping the HMAC signature verification story entirely, since real LeanIX doesn't sign payloads that way.
3. **GraphQL filtering**: replace `FilterInput.fieldFilters` with a `facetFilters` shape, add the `filterOptions { facets { ... } }` facet-discovery query, and decide how `factSheetType`/`status`/tags map onto facet keys.

Given the size of #2 and #3 especially, this needs a scoping decision before implementation — see the conversation for what was prioritized and why.
