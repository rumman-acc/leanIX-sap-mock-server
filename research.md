 I'll prepare a comprehensive technical specification document for your LeanIX Development Simulator. Let me compile everything into a single, actionable blueprint. 
 
    
     
         
         
  
  Your comprehensive technical specification is ready. Here's what the document contains:

---

## Document Summary

**[LeanIX Mock Server — Technical Specification](sandbox:///mnt/agents/output/LeanIX_Mock_Server_Technical_Specification.md)**  
*(64.7 KB | 2,769 lines | 17 major sections + 6 appendices)*

---

### What's Inside

| Section | What It Covers |
|---------|---------------|
| **1. Architecture** | System diagram, core principles, adapter pattern |
| **2. Tech Stack** | Node.js 20 + NestJS + Apollo + Prisma + PostgreSQL + Redis + BullMQ |
| **3. Project Structure** | Complete monorepo layout with 40+ files/folders |
| **4. Authentication** | OAuth 2.0 token flow, JWT claims, role-based access (ADMIN/MEMBER/VIEWER), mock dev credentials |
| **5. Rate Limiting** | 1,800 req/min per user, 1,200 per workspace, 429 responses with Retry-After |
| **6. Database Schema** | **Full Prisma schema** — 16 models: FactSheet, Relation, Tag, Subscription, TrashBin, SyncRun, Webhook, etc. |
| **7. GraphQL API** | Complete query/mutation specs: `factSheet`, `allFactSheets` (Relay pagination), `createFactSheet`, `updateFactSheet` (patch ops), `archiveFactSheet`, `reviveFactSheet`, `deleteFactSheet` |
| **8. REST API** | MTM token, Integration API configs, sync runs, webhook management — all endpoints with request/response examples |
| **9. LDIF Spec** | Required header fields, content structure, `partial` vs `full` mode, `inboundFactSheet` processor, sync run lifecycle |
| **10. Webhooks** | 6 supported events (ARCHIVED not DELETED), payload structure, HMAC-SHA256 signature, retry policy (10 attempts, 50s timeout) |
| **11. Meta Model** | 9 default fact sheet types, field definitions, relation types with cardinality |
| **12. Fact Sheet Lifecycle** | 5 phases (plan → phaseIn → active → phaseOut → endOfLife), quality seal, completion score |
| **13. MCP Server** | 8 AI tools for inventory, relations, architecture analysis |
| **14. Environment Config** | `.env.mock` and `.env.real` templates, adapter pattern code |
| **15. Error Codes** | 11 error codes with HTTP status and descriptions |
| **16. Implementation Phases** | 4-phase roadmap (Core → Integration → AI → Polish) with weekly timelines and test criteria |
| **17. Testing Strategy** | Unit, E2E, and integration test examples with actual code |

### Appendices
- **A:** Complete GraphQL Schema (types, enums, inputs, queries, mutations)
- **B:** 3 LDIF examples (simple import, with relations, full mode)
- **C:** 4 webhook payload examples (CREATED, UPDATED, ARCHIVED, RELATION_CREATED)
- **D:** Complete Prisma schema (copy-paste ready)
- **E:** Docker Compose configuration (API + PostgreSQL + Redis + Admin UI)
- **F:** Makefile with setup, dev, test, migrate, seed, clean commands

---

### Key Corrections From Your Original Research (Already Fixed in This Doc)

1. **Webhook events** — `FACT_SHEET_ARCHIVED` (not `DELETED`)
2. **Trash bin** — 90-day retention with scheduled auto-delete
3. **GraphQL pagination** — Relay-style `edges/nodes/pageInfo` (not offset)
4. **LDIF headers** — All 6 required fields documented
5. **Relation patches** — Path must include relation instance UUID
6. **Rate limits** — 1,800/min user, 1,200/min workspace
7. **OAuth** — No scopes; role-based JWT only
8. **Lifecycle** — Structured JSON with 5 phases
9. **Tags** — Group + Name hierarchy
10. **Subscriptions** — Type + Roles array

This is your single source of truth. Start with Phase 1, follow the test criteria at the end of each phase, and you'll have a production-quality mock that accurately represents LeanIX behavior.