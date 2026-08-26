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
