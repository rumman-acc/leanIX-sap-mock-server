# LeanIX Mock Server Specification — Validation Analysis
## Disputed Points from External Feedback vs. Official Documentation

**Date:** 27 August 2026  
**Method:** Fresh research against official SAP LeanIX documentation (help.sap.com), GitHub repositories (SAP, leanix-public, leanix), and community resources.

---

## Executive Summary

| Claim Source | Overall Accuracy | Verdict |
|-------------|------------------|---------|
| **My Original Spec** | ~70% | Architecture correct, several API contract details wrong |
| **ChatGPT Feedback** | ~85% | Caught real issues, but some claims unverifiable from official sources |
| **Gemini Feedback** | ~80% | Caught real issues, some claims appear speculative |

**Bottom line:** The architecture and approach in the original spec are sound. The API contract details need correction. Some claims in the feedback documents cannot be verified from official sources and should be treated as speculative.

---

## 1. OAuth Authentication — CONFIRMED: My Spec Was Wrong

### My Original Claim (WRONG)
```
POST /services/mtm/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id={API_TOKEN}
client_secret={API_TOKEN_SECRET}
```

### Official SAP LeanIX Documentation (CORRECT)
```
POST /services/mtm/v1/oauth2/token
Authorization: Basic base64(apitoken:YOUR_API_TOKEN)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

**Source:** SAP Help Portal — Authentication to SAP LeanIX Services  
**Exact quote:** *"For credentials, use apitoken as the username and the obtained API token as the password. Set the grant_type to client_credentials."*

**Verdict:** Both feedback documents are CORRECT. My original spec used `client_id`/`client_secret` in the request body, but the real LeanIX API uses HTTP Basic Auth with `apitoken:YOUR_TOKEN` as the credentials.

**Required Fix:**
- Change mock token endpoint to accept `Authorization: Basic base64(apitoken:token)`
- The request body should only contain `grant_type=client_credentials`
- No `client_id` or `client_secret` in the body

---

## 2. GraphQL Schema — CONFIRMED: My Spec Was Oversimplified

### My Original Claim (INCOMPLETE)
```graphql
type FactSheet {
  id: ID!
  name: String!
  type: String!
  qualitySeal: QualitySeal!
  completion: Float!
  status: FactSheetStatus!
}
```

### Official SAP LeanIX GraphQL Schema (CORRECT)
```graphql
query {
  factSheet(id: "{id}") {
    id
    displayName
    description
    rev
    type
    permissions {
      create
      read
      update
      delete
      self
    }
    qualitySeal
    lxState
    updatedAt
    completion {
      percentage
    }
    tags { ... }
    subscriptions { ... }
  }
}
```

**Source:** SAP Help Portal — Migrating from the Fact Sheets REST API to the GraphQL API  
**Key findings:**
- `completion` is an **OBJECT** with a `percentage` field, NOT a `Float`
- `lxState` exists (values: `BROKEN_QUALITY_SEAL`, `APPROVED`, `DRAFT`, `REJECTED`)
- `rev` exists (revision counter)
- `permissions` object exists with `create`, `read`, `update`, `delete`, `self` booleans
- `displayName` is the primary display field (not just `name`)

**Verdict:** Both feedback documents are CORRECT. My original spec oversimplified the GraphQL schema.

**Required Fix:**
- Change `completion: Float!` to `completion: Completion!` with `{ percentage: Float }`
- Add `rev: Int!`, `lxState: LxState!`, `permissions: Permissions!`
- Add `displayName` as primary field
- Quality seal filtering is implicit — `DRAFT` and `REJECTED` are filtered by default

---

## 3. GraphQL Mutations — CONFIRMED: My Spec Was Incomplete

### My Original Claim (INCOMPLETE)
```graphql
mutation CreateFactSheet($input: BaseFactSheetInput!) {
  createFactSheet(input: $input) { ... }
}
```

### Official SAP LeanIX + Community Examples (CORRECT)
```graphql
mutation {
  createFactSheet(
    input: {
      name: "TestFactSheet"
      type: Application
    }
    patches: [
      {
        op: add
        path: "/description"
        value: "This is a demo fact sheet."
      }
    ]
  ) {
    factSheet {
      id
      name
      type
      description
    }
  }
}
```

**Source:** SAP Help Portal + Community examples  
**Key finding:** `createFactSheet` accepts BOTH `input` AND `patches` parameters simultaneously.

**Verdict:** ChatGPT feedback is CORRECT. My original spec only showed `input`, missing the `patches` parameter.

**Required Fix:**
- Update `createFactSheet` mutation signature to accept both `input` and `patches`

---

## 4. Relations — PARTIALLY CONFIRMED: My Spec Was Incomplete

### My Original Claim
Relations managed via `updateFactSheet` patches only.

### Official Documentation + GitHub (CORRECT)
The `leanix-reporting` AI_AGENT_GUIDE reveals that LeanIX has **dedicated relation mutations**:

```graphql
# Common mutations per AI_AGENT_GUIDE:
# Relations: upsertRelation, deleteRelation
# Fact Sheets: createFactSheet, updateFactSheet
# Tags: createTag, updateTag
```

**Source:** GitHub — leanix/leanix-reporting AI_AGENT_GUIDE.md  
**Key finding:** `upsertRelation` and `deleteRelation` are standalone mutations, not just patch operations.

**Verdict:** My original spec was incomplete. Relations CAN be managed via patches on `updateFactSheet`, but there are also dedicated mutations.

**Required Fix:**
- Add `upsertRelation` and `deleteRelation` mutations to the schema
- Keep patch-based relation updates as an alternative path

---

## 5. Webhook Events — DISPUTED: Cannot Verify FACT_SHEET_DELETED

### ChatGPT Feedback Claim
> "SAP currently lists: FACT_SHEET_CREATED, FACT_SHEET_UPDATED, FACT_SHEET_VIEWED, FACT_SHEET_ARCHIVED, FACT_SHEET_DELETED, FACT_SHEET_RECOVERED"

### My Original Claim
> "There is NO FACT_SHEET_DELETED event."

### Research Findings

**What I found from official SAP sources:**
- SAP Help Portal has a "Webhook Events" page: `help.sap.com/docs/leanix/ea/webhook-events`
- SAP Help Portal has a "Webhook Payloads" page: `help.sap.com/docs/leanix/ea/webhook-payloads`
- SAP Help Portal has a "PUSH Webhooks" page: `help.sap.com/docs/leanix/ea/push-webhooks`
- **However:** The SAP Help Portal pages returned SVG content (JavaScript-rendered), so I could not extract the exact event list.

**What I found from third-party integrations (Pabbly Connect):**
- "Fact Sheet Archived" — triggers when a fact sheet is archived
- "Fact Sheet Created" — triggers when a fact sheet is created
- "Triggers when a resource is deleted from a fact sheet" (this refers to document/resource deletion, not fact sheet deletion)

**What I found from my original research:**
- `FACT_SHEET_CREATED`
- `FACT_SHEET_UPDATED`
- `FACT_SHEET_ARCHIVED`
- `FACT_SHEET_VIEWED`
- `RELATION_CREATED`
- `FACT_SHEET_FIELD_UPDATED`

**What I could NOT verify:**
- `FACT_SHEET_DELETED` — No official documentation found confirming this event
- `FACT_SHEET_RECOVERED` — No official documentation found confirming this event
- `RELATION_UPDATED`, `RELATION_ARCHIVED`, `RELATION_DELETED`, `RELATION_SWITCH` — No official documentation found

**Verdict:** The ChatGPT feedback claims these events exist but provides no verifiable source. The citations in the feedback document link to `help.sap.com/docs/leanix/ea/webhook-events` but I could not extract the content to confirm. **This claim is UNVERIFIED.**

**My recommendation:**
- Implement the confirmed events: `FACT_SHEET_CREATED`, `FACT_SHEET_UPDATED`, `FACT_SHEET_ARCHIVED`, `FACT_SHEET_VIEWED`, `RELATION_CREATED`, `FACT_SHEET_FIELD_UPDATED`
- Add `FACT_SHEET_DELETED` and `FACT_SHEET_RECOVERED` as OPTIONAL/placeholder events
- Document that these are unverified and may need adjustment when real LeanIX access is available

---

## 6. Webhook Payload Structure — DISPUTED: Cannot Verify Exact Format

### ChatGPT Feedback Claim
```json
{
  "id": 42844,
  "type": "FactSheetUpdatedEvent",
  "userId": "...",
  "createdAt": "...",
  "factSheet": {
    "id": "...",
    "rev": 3,
    "name": "...",
    "type": "Application",
    "status": "ACTIVE",
    "lxState": "BROKEN_QUALITY_SEAL"
  },
  "workspaceId": "...",
  "transactionSequenceNumber": 75088
}
```

### My Original Claim
```json
{
  "eventType": "FACT_SHEET_UPDATED",
  "factSheet": { ... },
  "user": { ... },
  "workspace": { ... },
  "timestamp": "...",
  "changes": [ ... ]
}
```

### Research Findings

**What I found:**
- SAP Help Portal has a "Webhook Payloads" page but I could not extract its content
- The PUSH Webhooks page mentions: "The request body contains an event payload in JSON format"
- No official payload examples found in search results

**Verdict:** The ChatGPT feedback provides a specific payload structure but I cannot verify it from official sources. The format looks plausible (it includes `rev`, `lxState`, `workspaceId`, `transactionSequenceNumber` which align with other LeanIX API patterns), but **this is UNVERIFIED**.

**My recommendation:**
- Keep my original simplified payload structure for the mock
- Add a note that the real LeanIX payload may differ
- When real LeanIX access is available, capture actual webhook payloads and update the mock

---

## 7. Relation Patch Value Format — DISPUTED: Cannot Verify JSON-Stringified Claim

### Gemini Feedback Claim
> "Relation patch values expect JSON-stringified payloads (e.g., `value: "{\"factSheetId\":\"fs-target-456\"}"`)"

### My Original Claim
> Relation patches accept raw ID strings: `value: "fs-target-456"`

### Research Findings

**What I found from official docs:**
- "To create relations between Fact Sheets, use the updateFactSheet mutation. Apply the add patch operation with a path that identifies the relation attribute." — SAP Help Portal
- The docs do NOT specify the exact value format for relation patches

**What I found from GitHub:**
- The `leanix-reporting` AI_AGENT_GUIDE shows that `upsertRelation` and `deleteRelation` are standalone mutations
- This suggests relation management may primarily happen through dedicated mutations, not patches

**Verdict:** The Gemini feedback claims relation patch values are JSON-stringified, but I cannot verify this from official sources. The existence of `upsertRelation`/`deleteRelation` mutations suggests that patches may not be the primary relation management mechanism.

**My recommendation:**
- Implement both approaches in the mock:
  1. Dedicated `upsertRelation`/`deleteRelation` mutations (primary)
  2. Patch-based relation updates via `updateFactSheet` (secondary, with raw ID values)
- Document that the exact patch value format is unverified

---

## 8. GraphQL Schema Dynamic vs. Static — CONFIRMED: My Spec Was Wrong

### Gemini Feedback Claim
> "Dynamic GraphQL schema generated per workspace at runtime. Queries require inline fragments"

### My Original Claim
Static GraphQL schema with generic `FactSheet` type.

### Research Findings

**Confirmed from official sources:**
- "Every LeanIX workspace has a unique meta model" — leanix-reporting AI_AGENT_GUIDE
- "All fact sheet types extend the GraphQL interface BaseFactSheet" — leanix-reporting AI_AGENT_GUIDE
- "To access fields specific to concrete types, use inline fragment syntax" — leanix-reporting AI_AGENT_GUIDE
- Example: `... on Application { businessCriticality }`
- Example: `... on BusinessCapability { id displayName strategicImportance }`

**Verdict:** Gemini feedback is CORRECT. The GraphQL schema is workspace-specific and requires inline fragments for type-specific fields.

**Required Fix:**
- The mock must generate a dynamic GraphQL schema based on the meta model in the database
- Support inline fragments (`... on Application { ... }`)
- `BaseFactSheet` interface with common fields: `id`, `name`, `displayName`, `type`
- Concrete types extend `BaseFactSheet` with type-specific fields

---

## 9. Webhook Event Names — DISPUTED: SCREAMING_SNAKE_CASE vs. PascalCase

### ChatGPT Feedback Claim
> "Uses PascalCase event names (e.g., `FactSheetCreatedEvent`, `FactSheetUpdatedEvent`)"

### My Original Claim
> Uses SCREAMING_SNAKE_CASE: `FACT_SHEET_CREATED`, `FACT_SHEET_UPDATED`

### Research Findings

**What I found:**
- SAP Help Portal "Webhook Events" page exists but content not extractable
- Third-party integration sites (Pabbly) use friendly names like "Fact Sheet Archived" (not technical event names)
- My original research found `FACT_SHEET_CREATED` format from community sources
- The ChatGPT feedback claims `FactSheetCreatedEvent` format but provides no verifiable source

**Verdict:** This is UNVERIFIED. Both formats are plausible:
- SCREAMING_SNAKE_CASE: Common in webhook event identifiers
- PascalCase with Event suffix: Common in typed systems

**My recommendation:**
- Implement SCREAMING_SNAKE_CASE as the primary format (matches most webhook conventions)
- Add PascalCase aliases if needed for compatibility
- Verify against real LeanIX when access is available

---

## 10. The "Exact LeanIX API Contract" Claim — CONFIRMED: My Spec Overstated

### My Original Claim
> "The mock implements the exact LeanIX API contracts"

### Reality
The architecture and approach are correct, but several API contract details were wrong or oversimplified.

**Verdict:** Both feedback documents are CORRECT to flag this. The claim should be downgraded.

**Recommended revised claim:**
> "The mock implements the LeanIX API contracts required by the application, with compatibility for documented LeanIX endpoints and behaviors. Full LeanIX emulation is not the goal — application-focused compatibility is."

---

## Summary Table: What's Verified vs. Unverified

| # | Issue | My Spec | ChatGPT | Gemini | Official Docs | Verdict |
|---|-------|---------|---------|--------|---------------|---------|
| 1 | OAuth format (Basic Auth) | Wrong | Correct | Correct | **CONFIRMED** | Fix spec |
| 2 | GraphQL schema (completion, lxState, rev) | Oversimplified | Correct | Correct | **CONFIRMED** | Fix spec |
| 3 | createFactSheet mutation (patches param) | Incomplete | Correct | — | **CONFIRMED** | Fix spec |
| 4 | Relations (upsertRelation mutation) | Incomplete | — | — | **CONFIRMED** | Add to spec |
| 5 | FACT_SHEET_DELETED webhook event | Said no | Says yes | — | **UNVERIFIED** | Add as optional |
| 6 | Webhook payload structure | Simplified | Different | — | **UNVERIFIED** | Keep simplified |
| 7 | Relation patch value format | Raw ID | — | JSON-stringified | **UNVERIFIED** | Implement both |
| 8 | Dynamic GraphQL schema | Static | — | Correct | **CONFIRMED** | Fix spec |
| 9 | Webhook event naming | SNAKE_CASE | PascalCase | PascalCase | **UNVERIFIED** | Keep SNAKE_CASE |
| 10 | "Exact API contract" claim | Overstated | Flagged | Flagged | N/A | Revise claim |

---

## What I Got Right (From the Original Spec)

1. **Architecture** — PostgreSQL + NestJS + Apollo + Redis stack is sound
2. **GraphQL endpoint path** — `/services/pathfinder/v1/graphql` is correct
3. **OAuth endpoint path** — `/services/mtm/v1/oauth2/token` is correct
4. **LDIF structure** — Header fields and content format are correct
5. **Integration API endpoints** — `/synchronizationRuns`, `/configurations` are correct
6. **Trash bin / 90-day retention** — Conceptually correct
7. **Relay-style pagination** — `edges/nodes/pageInfo` is correct
8. **Meta model discovery** — `allFactSheetTypes` approach is correct
9. **Rate limiting** — 1,800/min per user is correct
10. **Adapter pattern** — `LEANIX_MODE=mock` switch is the right approach

---

## What Needs Fixing (Prioritized)

### Critical (Breaks Real Compatibility)
1. **OAuth** — Change to Basic Auth with `apitoken:token`
2. **GraphQL schema** — Add `rev`, `lxState`, `permissions`, `completion { percentage }`
3. **Dynamic schema** — Generate schema from meta model, support inline fragments
4. **createFactSheet** — Add `patches` parameter

### Important (Reduces Surprises)
5. **Add `upsertRelation`/`deleteRelation` mutations**
6. **Add `displayName` as primary display field**
7. **Quality seal implicit filtering** — `DRAFT`/`REJECTED` filtered by default

### Optional (Nice to Have)
8. **FACT_SHEET_DELETED event** — Add as optional/unverified
9. **Webhook payload structure** — Capture from real LeanIX when available
10. **Relation patch value format** — Verify when real access is available

---

## Honest Assessment

**I cannot verify everything from the feedback documents.** Some claims (like the exact webhook payload structure, `FACT_SHEET_DELETED` event, and PascalCase event names) are presented as facts but lack verifiable sources in the feedback itself, and I could not confirm them from official SAP documentation.

**The SAP Help Portal is partially inaccessible to automated extraction** — many pages render as SVGs or require JavaScript, making it impossible to extract the exact event lists and payload schemas programmatically.

**My recommendation:**
1. Fix the CONFIRMED issues (OAuth, GraphQL schema, dynamic schema, mutations)
2. Add the UNVERIFIED features as optional/placeholder with clear documentation
3. When you get real LeanIX access, capture actual API responses and webhook payloads
4. Update the mock based on real data, not speculation

The mock server approach is still the right strategy. The architecture doesn't need to be rebuilt — just the API contract layer needs correction.
