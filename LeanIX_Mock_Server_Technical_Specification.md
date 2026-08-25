# LeanIX Development Simulator - Technical Specification

**Version:** 1.0  
**Date:** 25 August 2026  
**Purpose:** Complete blueprint for building a LeanIX-compatible mock server for zero-cost development  
**Target:** PostgreSQL + Node.js/TypeScript + Apollo Server + Docker Compose

---

## Table of Contents

1. Architecture Overview
2. Technology Stack
3. Project Structure
4. Authentication & Authorization
5. Rate Limiting
6. Database Schema
7. GraphQL API Specification
8. REST API Specification
9. Integration API & LDIF Specification
10. Webhook System
11. Meta Model System
12. Fact Sheet Lifecycle
13. MCP Server (Phase 3)
14. Environment Configuration
15. Error Codes & Responses
16. Implementation Phases
17. Testing Strategy
18. Appendix A: Complete GraphQL Schema
19. Appendix B: LDIF Examples
20. Appendix C: Webhook Payload Examples

---

## 1. Architecture Overview

```
+-------------------------------------------------------------+
|                     Your Application                          |
+----------------------------+--------------------------------+
                             |
              +--------------+--------------+
              |              |              |
              v              v              v
      +-----------+  +-----------+  +-----------+
      |  GraphQL  |  |   REST    |  |   MCP     |
      |  /graphql |  |  /api/*   |  |  /mcp     |
      +-----+-----+  +-----+-----+  +-----+-----+
            |              |              |
            +--------------+--------------+
                             |
                  +----------v----------+
                  |  Mock LeanIX Core   |
                  |                     |
                  | * Fact Sheet Engine |
                  | * Meta Model        |
                  | * Auth Service      |
                  | * Rate Limiter      |
                  | * Webhook Dispatcher|
                  | * LDIF Processor    |
                  +----------+----------+
                             |
                  +----------v----------+
                  |     PostgreSQL      |
                  |                     |
                  | * fact_sheets       |
                  | * relations         |
                  | * meta_model        |
                  | * sync_runs         |
                  | * webhooks          |
                  | * sync_logs         |
                  | * trash_bin         |
                  +---------------------+
```

### Core Principles

1. **API-First:** The mock implements the exact LeanIX API contracts
2. **State Persistence:** All data stored in PostgreSQL, not in-memory
3. **Deterministic:** Same inputs produce same outputs across restarts
4. **Observable:** Full sync logs, webhook delivery logs, error tracking
5. **Switchable:** Single env var switches between mock and real LeanIX

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 20.x LTS | Server runtime |
| Framework | NestJS | 10.x | API framework |
| GraphQL | Apollo Server | 4.x | GraphQL engine |
| GraphQL Schema | GraphQL Tools | 9.x | Schema stitching |
| Database | PostgreSQL | 16.x | Primary persistence |
| ORM | Prisma | 5.x | Database access |
| Queue | BullMQ | 5.x | Background jobs |
| Cache | Redis | 7.x | Session + queue |
| MCP | @modelcontextprotocol/sdk | latest | MCP server |
| Container | Docker | 24.x | Containerization |
| Orchestration | Docker Compose | 2.x | Local stack |
| Language | TypeScript | 5.x | Type safety |

### Why This Stack

- **NestJS + Apollo:** Industry standard for GraphQL APIs in Node.js
- **Prisma:** Type-safe database access with migration support
- **BullMQ:** Reliable background job processing for webhooks and sync runs
- **PostgreSQL:** Matches your application database, easy to query for debugging

---

## 3. Project Structure

```
leanix-dev-simulator/
|
|-- docker/
|   |-- docker-compose.yml
|   |-- Dockerfile.api
|   |-- init-scripts/
|   |   |-- 01-init-schema.sql
|
|-- apps/
|   |-- api/
|   |   |-- src/
|   |   |   |-- main.ts
|   |   |   |-- app.module.ts
|   |   |   |-- config/
|   |   |   |   |-- leanix.config.ts
|   |   |   |-- auth/
|   |   |   |   |-- auth.module.ts
|   |   |   |   |-- auth.service.ts
|   |   |   |   |-- auth.controller.ts
|   |   |   |   |-- guards/
|   |   |   |   |   |-- leanix-auth.guard.ts
|   |   |   |-- graphql/
|   |   |   |   |-- graphql.module.ts
|   |   |   |   |-- resolvers/
|   |   |   |   |   |-- fact-sheet.resolver.ts
|   |   |   |   |   |-- meta-model.resolver.ts
|   |   |   |   |   |-- search.resolver.ts
|   |   |   |   |-- schemas/
|   |   |   |   |   |-- leanix.graphql
|   |   |   |   |-- services/
|   |   |   |   |   |-- fact-sheet.service.ts
|   |   |   |-- rest/
|   |   |   |   |-- rest.module.ts
|   |   |   |   |-- controllers/
|   |   |   |   |   |-- mtm.controller.ts
|   |   |   |   |   |-- integration-api.controller.ts
|   |   |   |   |   |-- webhook.controller.ts
|   |   |   |   |-- services/
|   |   |   |   |   |-- integration-api.service.ts
|   |   |   |-- integration/
|   |   |   |   |-- integration.module.ts
|   |   |   |   |-- ldif/
|   |   |   |   |   |-- ldif.processor.ts
|   |   |   |   |   |-- ldif.validator.ts
|   |   |   |   |-- sync/
|   |   |   |   |   |-- sync-run.service.ts
|   |   |   |   |   |-- sync-log.service.ts
|   |   |   |-- webhooks/
|   |   |   |   |-- webhooks.module.ts
|   |   |   |   |-- webhook.service.ts
|   |   |   |   |-- webhook.controller.ts
|   |   |   |   |-- dispatchers/
|   |   |   |   |   |-- http.dispatcher.ts
|   |   |   |-- meta-model/
|   |   |   |   |-- meta-model.module.ts
|   |   |   |   |-- meta-model.service.ts
|   |   |   |   |-- seed/
|   |   |   |   |   |-- default-meta-model.ts
|   |   |   |-- trash-bin/
|   |   |   |   |-- trash-bin.module.ts
|   |   |   |   |-- trash-bin.service.ts
|   |   |   |   |-- trash-bin.scheduler.ts
|   |   |   |-- common/
|   |   |   |   |-- filters/
|   |   |   |   |   |-- graphql-exception.filter.ts
|   |   |   |   |-- interceptors/
|   |   |   |   |   |-- rate-limit.interceptor.ts
|   |   |   |   |-- utils/
|   |   |   |   |   |-- id-generator.ts
|   |   |-- test/
|   |   |   |-- jest.config.js
|   |   |   |-- e2e/
|   |   |   |   |-- graphql.e2e-spec.ts
|   |   |   |-- unit/
|   |   |   |   |-- fact-sheet.service.spec.ts
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   |-- nest-cli.json
|   |
|   |-- mcp/
|   |   |-- src/
|   |   |   |-- server.ts
|   |   |   |-- tools/
|   |   |   |   |-- inventory.tools.ts
|   |   |   |   |-- fact-sheet.tools.ts
|   |   |   |   |-- relation.tools.ts
|   |   |   |-- resources/
|   |   |   |   |-- workspace.resource.ts
|   |   |-- package.json
|
|-- packages/
|   |-- shared/
|   |   |-- src/
|   |   |   |-- types/
|   |   |   |   |-- leanix.types.ts
|   |   |   |   |-- ldif.types.ts
|   |   |   |-- constants/
|   |   |   |   |-- leanix.constants.ts
|   |   |   |-- utils/
|   |   |   |   |-- validators.ts
|   |   |-- package.json
|   |
|   |-- prisma/
|   |   |-- schema.prisma
|   |   |-- migrations/
|   |   |-- seed.ts
|
|-- docs/
|   |-- API_REFERENCE.md
|   |-- MIGRATION_GUIDE.md
|
|-- scripts/
|   |-- setup.sh
|   |-- seed-workspace.sh
|
|-- .env.example
|-- .env.mock
|-- Makefile
|-- README.md
```

---

## 4. Authentication & Authorization

### 4.1 OAuth 2.0 Token Flow

```
+---------------+     +------------------+     +---------------+
|   Your App    |     |   Mock LeanIX    |     |   PostgreSQL  |
|               |     |   MTM Service    |     |               |
+-------+-------+     +--------+---------+     +---------------+
        |                      |
        | POST /services/mtm/  |
        | v1/oauth2/token      |
        | -------------------->|
        |                      |
        | grant_type=client_   |
        | credentials          |
        | client_id={apiToken} |
        | client_secret={secret}|
        |                      |
        |                      |--- Validate credentials --->
        |                      |                            |
        |                      |<--- Valid + role info -----|
        |                      |
        | 200 OK               |
        | {                    |
        |   "access_token":    |
        |     "eyJhbGci...",   |
        |   "token_type":      |
        |     "bearer",        |
        |   "expires_in": 3600,|
        |   "scope": ""        |
        | }                    |
        | <--------------------|
```

### 4.2 Token Endpoint

**URL:** POST /services/mtm/v1/oauth2/token

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Body (x-www-form-urlencoded):**
```
grant_type=client_credentials
client_id={API_TOKEN}
client_secret={API_TOKEN_SECRET}
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": ""
}
```

**Error Response (401):**
```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

### 4.3 JWT Token Structure

The access_token is a JWT with the following claims:

```json
{
  "sub": "technical-user-id",
  "iss": "leanix-mock",
  "aud": "leanix-services",
  "iat": 1724563200,
  "exp": 1724566800,
  "workspaceId": "mock-workspace-id",
  "workspaceName": "development",
  "workspaceRole": "ADMIN",
  "userName": "technical-user@mock.local"
}
```

**Important:** LeanIX does NOT use OAuth scopes. Access control is entirely role-based via workspaceRole.

### 4.4 Role-Based Access Control

| Role | GraphQL Read | GraphQL Write | Integration API | Admin APIs |
|------|-------------|---------------|-----------------|------------|
| ADMIN | Yes | Yes | Yes | Yes |
| MEMBER | Yes | Yes | Yes | No |
| VIEWER | Yes | No | No | No |

### 4.5 Mock Credentials (Development)

```env
LEANIX_API_TOKEN=dev-token-12345
LEANIX_API_TOKEN_SECRET=dev-secret-67890
LEANIX_WORKSPACE=development
LEANIX_SUBDOMAIN=mock
```

**Mock token endpoint behavior:**
- Accepts any client_id starting with dev-token-
- Accepts any client_secret starting with dev-secret-
- Returns a valid JWT with workspaceRole: ADMIN
- Token expires in 1 hour

---

## 5. Rate Limiting

### 5.1 Limits

| Scope | Limit | Window | HTTP Header |
|-------|-------|--------|-------------|
| Per User (including technical users) | 1,800 requests | 1 minute | X-RateLimit-User-Limit: 1800 |
| Per Workspace (internal requests) | 1,200 requests | 1 minute | X-RateLimit-Workspace-Limit: 1200 |

### 5.2 Rate Limit Headers

Every response includes:
```
X-RateLimit-Limit: 1800
X-RateLimit-Remaining: 1799
X-RateLimit-Reset: 1724563260
```

### 5.3 Exceeded Response (429)

```json
{
  "error": "Rate limit exceeded",
  "message": "You have exceeded the rate limit of 1800 requests per minute",
  "retryAfter": 45
}
```

HTTP Status: 429 Too Many Requests  
Header: Retry-After: 45

### 5.4 Implementation Notes

- Use Redis for distributed rate limit counters
- Count ALL requests (GraphQL + REST) against the same limit
- Technical users count against per-user limit
- Reset counter on sliding window (not fixed window)

---

## 6. Database Schema

### 6.1 Prisma Schema

See the full Prisma schema in the file. Key models include:

- **FactSheetType** - Meta model types (Application, ITComponent, etc.)
- **Attribute** - Fields within each type with technical keys
- **AllowedValue** - Enum values for select fields
- **RelationType** - Defines relationships between types
- **FactSheet** - Core entity with lifecycle, quality seal, completion
- **AttributeValue** - JSON-stored values for any data type
- **Relation** - Links between fact sheets
- **Tag / TagGroup / TagAssignment** - Hierarchical tagging
- **Subscription** - User subscriptions with roles
- **TrashBinEntry** - 90-day retention tracking
- **SyncMapping** - Source-to-LeanIX record mapping
- **SyncRun / SyncLog** - Integration processing logs
- **Webhook / WebhookDelivery** - Event dispatch tracking
- **User / Workspace** - Auth and workspace context

### 6.2 Key Design Decisions

1. **JSONB for lifecycle:** Lifecycle is a complex nested structure, not a simple string
2. **Separate trash_bin table:** Enables 90-day retention with scheduled cleanup
3. **Sync hash:** SHA-256 of normalized source data for change detection
4. **Webhook delivery log:** Full audit trail of every webhook attempt
5. **Attribute values as JSON:** Supports STRING, NUMBER, DATE, BOOLEAN, URL, etc.


---

## 7. GraphQL API Specification

### 7.1 Endpoint

```
POST /services/pathfinder/v1/graphql
```

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### 7.2 Queries

#### 7.2.1 factSheet - Get Single Fact Sheet

```graphql
query GetFactSheet($id: ID!) {
  factSheet(id: $id) {
    id
    name
    type
    description
    displayName
    externalId
    lifecycle {
      asString
      phases {
        phase
        startDate
      }
    }
    qualitySeal
    completion
    status
    createdAt
    updatedAt
    createdBy
    updatedBy
    tags {
      id
      name
      group {
        name
      }
    }
    subscriptions {
      id
      user {
        id
        name
        email
      }
      type
      roles
    }
    ... on Application {
      relApplicationToITComponent {
        edges {
          node {
            id
            factSheet {
              id
              name
              type
            }
          }
        }
      }
    }
  }
}
```

**Variables:**
```json
{ "id": "fs-12345" }
```

#### 7.2.2 allFactSheets - List with Relay Pagination

```graphql
query AllFactSheets(
  $filter: FilterInput
  $sort: SortInput
  $first: Int
  $after: String
) {
  allFactSheets(
    filter: $filter
    sort: $sort
    first: $first
    after: $after
  ) {
    totalCount
    edges {
      node {
        id
        name
        type
        description
        externalId
        status
        qualitySeal
        completion
        updatedAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
      hasPreviousPage
      startCursor
    }
  }
}
```

**Variables:**
```json
{
  "filter": {
    "factSheetType": "Application",
    "status": "ACTIVE",
    "fieldFilters": [
      { "key": "name", "values": ["CRM"] }
    ]
  },
  "sort": {
    "mode": "BY_FIELD",
    "key": "updatedAt",
    "direction": "DESC"
  },
  "first": 50,
  "after": null
}
```

**Response:**
```json
{
  "data": {
    "allFactSheets": {
      "totalCount": 127,
      "edges": [
        {
          "node": {
            "id": "fs-abc123",
            "name": "SAP CRM",
            "type": "Application",
            "description": "Customer relationship management",
            "externalId": "SAP-CRM-001",
            "status": "ACTIVE",
            "qualitySeal": "APPROVED",
            "completion": 85.5,
            "updatedAt": "2026-08-24T10:30:00Z"
          },
          "cursor": "eyJpZCI6ImZzLWFiYzEyMyJ9"
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "endCursor": "eyJpZCI6ImZzLWF4eTk5OSJ9",
        "hasPreviousPage": false,
        "startCursor": "eyJpZCI6ImZzLWFiYzEyMyJ9"
      }
    }
  }
}
```

#### 7.2.3 allFactSheetTypes - Meta Model Discovery

```graphql
query AllFactSheetTypes {
  allFactSheetTypes {
    id
    name
    label
    description
    icon
    color
    enabled
    fields {
      id
      name
      label
      description
      type
      mandatory
      hidden
      readOnly
      allowedValues {
        id
        value
        label
        color
      }
    }
    relations {
      id
      name
      label
      description
      targetType {
        name
        label
      }
      cardinality
      mandatory
    }
  }
}
```

#### 7.2.4 search - Full-Text Search

```graphql
query Search($query: String!, $first: Int) {
  search(query: $query, first: $first) {
    totalCount
    edges {
      node {
        id
        name
        type
        description
        highlight
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### 7.3 Mutations

#### 7.3.1 createFactSheet

```graphql
mutation CreateFactSheet($input: BaseFactSheetInput!) {
  createFactSheet(input: $input) {
    factSheet {
      id
      name
      type
      description
      externalId
      status
      createdAt
      updatedAt
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "name": "New Application",
    "type": "Application",
    "description": "Description here",
    "externalId": "EXT-001",
    "tags": [
      { "name": "status/active", "group": { "name": "status" } }
    ],
    "subscriptions": [
      {
        "user": { "email": "user@example.com" },
        "type": "RESPONSIBLE"
      }
    ]
  }
}
```

**Validation Rules:**
- name is required, max 255 chars
- type must exist in meta model
- externalId must be unique within type (if provided)
- Auto-generate displayName from name
- Set createdBy / updatedBy from JWT sub

#### 7.3.2 updateFactSheet - Patch Operations

```graphql
mutation UpdateFactSheet($id: ID!, $patches: [Patch]!) {
  updateFactSheet(id: $id, patches: $patches) {
    factSheet {
      id
      name
      updatedAt
    }
  }
}
```

**Patch Operations:**

| Op | Path | Value | Description |
|----|------|-------|-------------|
| replace | /name | "New Name" | Update simple field |
| replace | /description | "New desc" | Update description |
| replace | /externalId | "EXT-002" | Update external ID |
| replace | /lifecycle | {...} | Update lifecycle object |
| add | /tags | {name: "x", group: {name: "y"}} | Add tag |
| remove | /tags/tag-uuid | null | Remove tag by ID |
| replace | /relTypeUUID/rel-uuid | "target-fs-id" | Update relation target |
| add | /relTypeUUID | "target-fs-id" | Add relation |
| remove | /relTypeUUID/rel-uuid | null | Remove relation |

**Variables - Update Name:**
```json
{
  "id": "fs-abc123",
  "patches": [
    { "op": "replace", "path": "/name", "value": "Updated Name" }
  ]
}
```

**Variables - Update Relation:**
```json
{
  "id": "fs-abc123",
  "patches": [
    {
      "op": "replace",
      "path": "/relApplicationToITComponent/rel-uuid-123",
      "value": "fs-target-456"
    }
  ]
}
```

**Important:** For relation updates, the path must contain the relation instance ID, not just the relation type.

#### 7.3.3 archiveFactSheet

```graphql
mutation ArchiveFactSheet($id: ID!) {
  archiveFactSheet(id: $id) {
    factSheet {
      id
      name
      status
      trashBin
      archivedAt
      autoDeleteAt
    }
  }
}
```

**Behavior:**
1. Set status to ARCHIVED
2. Set trashBin to true
3. Set archivedAt to now()
4. Set autoDeleteAt to now() + 90 days
5. Move to trash_bin table
6. Trigger FACT_SHEET_ARCHIVED webhook

#### 7.3.4 reviveFactSheet - Recover from Trash

```graphql
mutation ReviveFactSheet($id: ID!) {
  reviveFactSheet(id: $id) {
    factSheet {
      id
      name
      status
      trashBin
    }
  }
}
```

**Behavior:**
1. Set status to ACTIVE
2. Set trashBin to false
3. Clear archivedAt and autoDeleteAt
4. Remove from trash_bin table
5. Trigger FACT_SHEET_UPDATED webhook

#### 7.3.5 deleteFactSheet - Permanent Delete (from trash only)

```graphql
mutation DeleteFactSheet($id: ID!) {
  deleteFactSheet(id: $id) {
    id
  }
}
```

**Behavior:**
- Only allowed if trashBin = true
- Permanently deletes the fact sheet and all relations
- No webhook triggered (fact sheet is already archived)

### 7.4 GraphQL Introspection

The mock server MUST support full GraphQL introspection:

```graphql
query IntrospectionQuery {
  __schema {
    types {
      name
      kind
      fields {
        name
        type {
          name
          kind
        }
      }
    }
  }
}
```

This is critical for:
- GraphiQL/Playground functionality
- Client code generation
- Meta model discovery

---

## 8. REST API Specification

### 8.1 MTM (Authentication) API

#### POST /services/mtm/v1/oauth2/token

See Section 4.2 for full specification.

### 8.2 Integration API

#### POST /services/integration-api/v1/configurations

Create or update an integration configuration.

**Request:**
```json
{
  "name": "SAP Connector",
  "connectorType": "sap-connector",
  "connectorId": "sap-prod",
  "connectorVersion": "1.0.0",
  "processingDirection": "inbound",
  "processingMode": "partial",
  "processors": [
    {
      "processorType": "inboundFactSheet",
      "processorName": "Applications from SAP",
      "processorDescription": "Import applications",
      "run": 0,
      "enabled": true,
      "variables": [],
      "identifier": {
        "external": {
          "id": {
            "key": "externalId",
            "value": "${data.externalId}"
          },
          "type": {
            "key": "type",
            "value": "${data.type}"
          }
        }
      },
      "updates": [
        {
          "key": {
            "expr": "${data.type}"
          },
          "values": [
            {
              "key": "name",
              "expr": "${data.name}"
            },
            {
              "key": "description",
              "expr": "${data.description}"
            }
          ]
        }
      ],
      "logLevel": "INFO"
    }
  ]
}
```

**Response (201):**
```json
{
  "id": "cfg-12345",
  "name": "SAP Connector",
  "connectorType": "sap-connector",
  "status": "ACTIVE",
  "createdAt": "2026-08-25T10:00:00Z"
}
```

#### POST /services/integration-api/v1/synchronizationRuns

Execute a sync run with inline LDIF.

**Request:**
```json
{
  "connectorType": "sap-connector",
  "connectorId": "sap-prod",
  "connectorVersion": "1.0.0",
  "lxVersion": "1.0.0",
  "processingDirection": "inbound",
  "processingMode": "partial",
  "description": "Daily sync from SAP",
  "content": [
    {
      "type": "Application",
      "id": "SAP-001",
      "data": {
        "name": "SAP ERP",
        "externalId": "SAP-001",
        "description": "Enterprise resource planning"
      }
    }
  ]
}
```

**Response (202):**
```json
{
  "id": "sync-run-67890",
  "status": "CREATED",
  "createdAt": "2026-08-25T10:00:00Z"
}
```

#### GET /services/integration-api/v1/synchronizationRuns/{id}

**Response (200):**
```json
{
  "id": "sync-run-67890",
  "status": "FINISHED",
  "startedAt": "2026-08-25T10:00:01Z",
  "finishedAt": "2026-08-25T10:00:05Z",
  "errorCount": 0,
  "warningCount": 1,
  "processedCount": 1,
  "createdCount": 1,
  "updatedCount": 0,
  "deletedCount": 0
}
```

#### POST /services/integration-api/v1/synchronizationRuns/withUrlInput

Execute a sync run by fetching LDIF from a URL.

**Request:**
```json
{
  "connectorType": "sap-connector",
  "connectorId": "sap-prod",
  "connectorVersion": "1.0.0",
  "lxVersion": "1.0.0",
  "processingDirection": "inbound",
  "processingMode": "partial",
  "description": "Sync from URL",
  "url": "https://your-server.com/ldif.json"
}
```

### 8.3 Webhook Management API

#### POST /services/webhook/v1/webhooks

Register a new webhook.

**Request:**
```json
{
  "url": "https://your-app.com/webhooks/leanix",
  "events": [
    "FACT_SHEET_CREATED",
    "FACT_SHEET_UPDATED",
    "FACT_SHEET_ARCHIVED",
    "RELATION_CREATED"
  ],
  "secret": "your-webhook-secret"
}
```

**Response (201):**
```json
{
  "id": "wh-12345",
  "url": "https://your-app.com/webhooks/leanix",
  "events": ["FACT_SHEET_CREATED", "FACT_SHEET_UPDATED"],
  "active": true,
  "createdAt": "2026-08-25T10:00:00Z"
}
```

#### GET /services/webhook/v1/webhooks

List all registered webhooks.

#### DELETE /services/webhook/v1/webhooks/{id}

Delete a webhook.

### 8.4 REST API Endpoints Summary

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /services/mtm/v1/oauth2/token | Get access token | Public |
| POST | /services/integration-api/v1/configurations | Create integration config | Bearer |
| GET | /services/integration-api/v1/configurations | List configs | Bearer |
| POST | /services/integration-api/v1/synchronizationRuns | Run sync (inline) | Bearer |
| POST | /services/integration-api/v1/synchronizationRuns/withUrlInput | Run sync (URL) | Bearer |
| GET | /services/integration-api/v1/synchronizationRuns/{id} | Get sync status | Bearer |
| POST | /services/webhook/v1/webhooks | Register webhook | Bearer |
| GET | /services/webhook/v1/webhooks | List webhooks | Bearer |
| DELETE | /services/webhook/v1/webhooks/{id} | Delete webhook | Bearer |

---

## 9. Integration API & LDIF Specification

### 9.1 LDIF Structure

LDIF (LeanIX Data Interchange Format) is a JSON structure with required header fields.

```json
{
  "connectorType": "your-connector-type",
  "connectorId": "your-connector-id",
  "connectorVersion": "1.0.0",
  "lxVersion": "1.0.0",
  "processingDirection": "inbound",
  "processingMode": "partial",
  "description": "Optional description",
  "content": [
    {
      "type": "Application",
      "id": "source-record-id",
      "data": {
        "name": "Application Name",
        "externalId": "EXT-001",
        "description": "Description",
        "lifecycle": {
          "asString": "plan",
          "phases": [
            { "phase": "plan", "startDate": "2024-01-01" },
            { "phase": "phaseIn", "startDate": "2025-01-01" }
          ]
        }
      }
    }
  ]
}
```

### 9.2 Required Header Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| connectorType | string | Yes | Connector category |
| connectorId | string | Yes | Unique connector identifier |
| connectorVersion | string | Yes | Connector version (semver) |
| lxVersion | string | Yes | LDIF format version |
| processingDirection | string | Yes | inbound or outbound |
| processingMode | string | Yes | partial or full |
| description | string | No | Human-readable description |
| content | array | Yes | Array of data objects |

### 9.3 Content Object Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Fact sheet type (must exist in meta model) |
| id | string | Yes | Source system identifier |
| data | object | Yes | Key-value pairs of fact sheet data |

### 9.4 Processing Mode

| Mode | Behavior |
|------|----------|
| partial | Only update provided fields. Existing fields not in LDIF are preserved. |
| full | Replace entire fact sheet. Fields not in LDIF are removed. |

### 9.5 InboundFactSheet Processor

The processor configuration defines how LDIF maps to LeanIX:

```json
{
  "processorType": "inboundFactSheet",
  "processorName": "Import Applications",
  "processorDescription": "Imports applications from external system",
  "run": 0,
  "enabled": true,
  "variables": [],
  "identifier": {
    "external": {
      "id": {
        "key": "externalId",
        "value": "${data.externalId}"
      },
      "type": {
        "key": "type",
        "value": "${data.type}"
      }
    }
  },
  "updates": [
    {
      "key": {
        "expr": "${data.type}"
      },
      "values": [
        {
          "key": "name",
          "expr": "${data.name}"
        },
        {
          "key": "description",
          "expr": "${data.description}"
        },
        {
          "key": "lifecycle",
          "expr": "${data.lifecycle}"
        }
      ]
    }
  ],
  "logLevel": "INFO"
}
```

### 9.6 Sync Run Lifecycle

```
CREATED -> RUNNING -> FINISHED
              |
              v
           FAILED
              |
         (retry possible)
```

**States:**
- CREATED: Run initialized, not yet started
- RUNNING: Processing content
- FINISHED: All items processed successfully
- FAILED: Error occurred, processing stopped
- CANCELLED: Manually cancelled

### 9.7 Sync Log Levels

| Level | Description |
|-------|-------------|
| INFO | General processing information |
| WARNING | Non-fatal issues (e.g., field skipped) |
| ERROR | Fatal errors (e.g., invalid fact sheet type) |

---

## 10. Webhook System

### 10.1 Supported Events

| Event | Description | Trigger |
|-------|-------------|---------|
| FACT_SHEET_CREATED | New fact sheet created | createFactSheet mutation |
| FACT_SHEET_UPDATED | Fact sheet modified | updateFactSheet, reviveFactSheet |
| FACT_SHEET_ARCHIVED | Fact sheet archived | archiveFactSheet mutation |
| FACT_SHEET_VIEWED | Fact sheet viewed | Not implemented in mock |
| RELATION_CREATED | New relation created | Relation add patch |
| FACT_SHEET_FIELD_UPDATED | Specific field changed | updateFactSheet mutation |

**Important:** There is NO FACT_SHEET_DELETED event. LeanIX archives first, then auto-deletes after 90 days.

### 10.2 Webhook Payload Structure

```json
{
  "eventType": "FACT_SHEET_UPDATED",
  "factSheet": {
    "id": "fs-abc123",
    "type": "Application",
    "name": "SAP CRM",
    "externalId": "SAP-CRM-001"
  },
  "user": {
    "id": "user-001",
    "name": "John Doe",
    "email": "john.doe@example.com"
  },
  "workspace": {
    "id": "ws-001",
    "name": "development"
  },
  "timestamp": "2026-08-25T10:30:00.000Z",
  "changes": [
    {
      "field": "name",
      "oldValue": "Old Name",
      "newValue": "New Name"
    }
  ]
}
```

### 10.3 Webhook Delivery

**HTTP Request:**
```
POST {webhook.url}
Content-Type: application/json
X-LeanIX-Event: FACT_SHEET_UPDATED
X-LeanIX-Delivery: delivery-uuid
X-LeanIX-Signature: sha256={hmac}
```

**Signature Calculation:**
```
signature = HMAC-SHA256(webhook.secret, payload_body)
```

### 10.4 Retry Policy

| Attempt | Delay | Condition |
|---------|-------|-----------|
| 1 | Immediate | Initial delivery |
| 2 | 5 seconds | HTTP 4xx/5xx or timeout |
| 3 | 25 seconds | Second failure |
| 4 | 2 minutes | Third failure |
| 5 | 10 minutes | Fourth failure |
| 6+ | 1 hour | Subsequent failures |

**Max retry:** 10 attempts  
**Timeout:** 50 seconds per request  
**Success codes:** 2xx

### 10.5 Webhook Registration

Webhooks are registered per workspace. The mock should support:
- Multiple webhooks per workspace
- Event filtering (subscribe to specific events)
- Active/inactive toggle
- Delivery history and logs

---

## 11. Meta Model System

### 11.1 Default Meta Model (Seed Data)

The mock should ship with a default meta model:

**Fact Sheet Types:**
- Application
- BusinessCapability
- ITComponent
- Provider
- Process
- Project
- DataObject
- Interface
- TechnicalStack

**Example: Application Type Fields**

| Technical Key | Label | Type | Mandatory |
|--------------|-------|------|-----------|
| name | Name | STRING | Yes |
| description | Description | STRING | No |
| externalId | External ID | STRING | No |
| lifecycle | Lifecycle | SINGLE_SELECT | No |
| functionalSuitability | Functional Suitability | SINGLE_SELECT | No |
| technicalSuitability | Technical Suitability | SINGLE_SELECT | No |
| businessCriticality | Business Criticality | SINGLE_SELECT | No |

**Example: Relation Types**

| Technical Key | Source | Target | Cardinality |
|--------------|--------|--------|-------------|
| relApplicationToITComponent | Application | ITComponent | MANY_TO_MANY |
| relApplicationToBusinessCapability | Application | BusinessCapability | MANY_TO_MANY |
| relApplicationToApplication | Application | Application | MANY_TO_MANY |
| relApplicationToProvider | Application | Provider | MANY_TO_MANY |
| relITComponentToProvider | ITComponent | Provider | MANY_TO_MANY |

### 11.2 Meta Model Discovery API

The mock must expose the meta model through:
1. GraphQL introspection
2. allFactSheetTypes query
3. Individual type queries

### 11.3 Custom Meta Model Support

The mock should allow:
- Adding new fact sheet types
- Adding new attributes to existing types
- Adding new relation types
- Modifying allowed values

---

## 12. Fact Sheet Lifecycle

### 12.1 Lifecycle Structure

```json
{
  "lifecycle": {
    "asString": "plan",
    "phases": [
      {
        "phase": "plan",
        "startDate": "2024-01-01"
      },
      {
        "phase": "phaseIn",
        "startDate": "2025-01-01"
      },
      {
        "phase": "active",
        "startDate": "2026-01-01"
      },
      {
        "phase": "phaseOut",
        "startDate": null
      },
      {
        "phase": "endOfLife",
        "startDate": null
      }
    ]
  }
}
```

### 12.2 Lifecycle Phases

| Phase | Description |
|-------|-------------|
| plan | Planned but not yet started |
| phaseIn | Being introduced |
| active | Fully operational |
| phaseOut | Being retired |
| endOfLife | No longer supported |

### 12.3 Quality Seal

| Seal | Description | Calculation |
|------|-------------|-------------|
| BROKEN | Incomplete or invalid | Default for new fact sheets |
| APPROVED | Reviewed and valid | Set manually or by automation |

### 12.4 Completion Score

Auto-calculated based on:
- Mandatory fields populated
- Relations present
- Description provided
- Tags assigned
- Subscriptions set

Formula (simplified):
```
completion = (filled_mandatory_fields / total_mandatory_fields) * 100
```


---

## 13. MCP Server (Phase 3)

### 13.1 MCP Endpoint

```
POST /mcp
Content-Type: application/json
```

### 13.2 Tools to Implement

| Tool | Description |
|------|-------------|
| search_fact_sheets | Search inventory by name/type |
| get_fact_sheet | Retrieve full fact sheet details |
| get_relations | Explore fact sheet relationships |
| create_fact_sheet | Create new fact sheet |
| update_fact_sheet | Update existing fact sheet |
| get_meta_model | List available fact sheet types |
| get_reports | List available reports |
| explain_architecture | AI analysis of dependencies |

### 13.3 Authentication

MCP server uses the same OAuth tokens as GraphQL/REST.

---

## 14. Environment Configuration

### 14.1 Mock Mode (.env.mock)

```env
# === LeanIX Mode ===
LEANIX_MODE=mock
LEANIX_BASE_URL=http://localhost:4000
LEANIX_SUBDOMAIN=mock

# === Authentication ===
LEANIX_API_TOKEN=dev-token-12345
LEANIX_API_TOKEN_SECRET=dev-secret-67890
LEANIX_WORKSPACE=development

# === Database ===
DATABASE_URL=postgresql://leanix:leanix@localhost:5432/leanix_mock?schema=public

# === Redis ===
REDIS_URL=redis://localhost:6379/0

# === Server ===
PORT=4000
NODE_ENV=development

# === Mock Features ===
MOCK_RATE_LIMIT_ENABLED=true
MOCK_WEBHOOK_DELIVERY_ENABLED=true
MOCK_AUTO_DELETE_ENABLED=true
MOCK_TRASH_BIN_RETENTION_DAYS=90
```

### 14.2 Real Mode (.env.real)

```env
LEANIX_MODE=real
LEANIX_BASE_URL=https://company.leanix.net
LEANIX_SUBDOMAIN=company
LEANIX_API_TOKEN=REAL_TOKEN_HERE
LEANIX_API_TOKEN_SECRET=REAL_SECRET_HERE
LEANIX_WORKSPACE=production
```

### 14.3 Application Adapter Pattern

Your application should read LEANIX_MODE and instantiate the appropriate adapter:

```typescript
// leanix.adapter.ts
if (process.env.LEANIX_MODE === 'mock') {
  return new MockLeanIXAdapter();
} else {
  return new RealLeanIXAdapter();
}
```

Both adapters implement the same interface:
```typescript
interface ILeanIXAdapter {
  queryFactSheets(filter: FilterInput): Promise<FactSheetConnection>;
  getFactSheet(id: string): Promise<FactSheet>;
  createFactSheet(input: BaseFactSheetInput): Promise<FactSheet>;
  updateFactSheet(id: string, patches: Patch[]): Promise<FactSheet>;
  archiveFactSheet(id: string): Promise<FactSheet>;
  runLDIF(ldif: LDIF): Promise<SyncRun>;
  registerWebhook(config: WebhookConfig): Promise<Webhook>;
}
```

---

## 15. Error Codes & Responses

### 15.1 GraphQL Errors

```json
{
  "errors": [
    {
      "message": "Fact sheet not found",
      "extensions": {
        "code": "FACT_SHEET_NOT_FOUND",
        "id": "fs-nonexistent"
      }
    }
  ],
  "data": null
}
```

### 15.2 Error Code Reference

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHENTICATED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient role permissions |
| FACT_SHEET_NOT_FOUND | 404 | Fact sheet ID does not exist |
| FACT_SHEET_TYPE_NOT_FOUND | 404 | Invalid fact sheet type |
| INVALID_PATCH | 400 | Patch operation invalid |
| DUPLICATE_EXTERNAL_ID | 409 | externalId already exists |
| RELATION_NOT_FOUND | 404 | Relation ID does not exist |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INVALID_LDIF | 400 | LDIF structure invalid |
| SYNC_RUN_NOT_FOUND | 404 | Sync run ID does not exist |
| WEBHOOK_DELIVERY_FAILED | 502 | Webhook target unreachable |

### 15.3 REST Error Format

```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

---

## 16. Implementation Phases

### Phase 1: Core (Weeks 1-3)

**Goal:** Basic GraphQL CRUD with persistence

**Deliverables:**
- [ ] Docker Compose setup (API + PostgreSQL + Redis)
- [ ] Prisma schema + migrations
- [ ] OAuth token endpoint (mock)
- [ ] GraphQL endpoint with introspection
- [ ] Fact Sheet CRUD (create, read, update, archive)
- [ ] Relay-style pagination
- [ ] Meta model seed (Application, ITComponent, etc.)
- [ ] Basic attributes (name, description, externalId)
- [ ] Trash bin with 90-day retention
- [ ] Rate limiting (1800/min)
- [ ] Error handling

**Test Criteria:**
```bash
# Should work:
curl -X POST http://localhost:4000/services/pathfinder/v1/graphql \
  -H "Authorization: Bearer $(get_token)" \
  -d '{"query": "query { allFactSheets { totalCount } }"}'
```

### Phase 2: Integration (Weeks 4-5)

**Goal:** LDIF processing and webhooks

**Deliverables:**
- [ ] Integration API endpoints
- [ ] LDIF validation and processing
- [ ] InboundFactSheet processor
- [ ] Sync run lifecycle (CREATED -> RUNNING -> FINISHED)
- [ ] Sync logs with row-level detail
- [ ] Webhook registration/management
- [ ] Webhook dispatch with retry logic
- [ ] Webhook signature (HMAC-SHA256)
- [ ] Relation CRUD via GraphQL patches
- [ ] Tag management
- [ ] Subscription management

**Test Criteria:**
```bash
# Should work:
curl -X POST http://localhost:4000/services/integration-api/v1/synchronizationRuns \
  -H "Authorization: Bearer $(get_token)" \
  -d '{"connectorType": "test", "content": [{"type": "Application", "id": "1", "data": {"name": "Test"}}]}'
```

### Phase 3: AI / MCP (Week 6)

**Goal:** MCP server for AI integration

**Deliverables:**
- [ ] MCP server endpoint
- [ ] Inventory search tool
- [ ] Fact Sheet detail tool
- [ ] Relation exploration tool
- [ ] Architecture analysis tool
- [ ] Report listing tool

### Phase 4: Polish (Week 7)

**Goal:** Production-ready mock

**Deliverables:**
- [ ] Admin UI (React) for browsing mock data
- [ ] GraphQL Playground enabled
- [ ] Comprehensive test suite (e2e + unit)
- [ ] Documentation
- [ ] Sample data seed scripts
- [ ] Performance optimization

---

## 17. Testing Strategy

### 17.1 Unit Tests

```typescript
// fact-sheet.service.spec.ts
describe('FactSheetService', () => {
  it('should create a fact sheet with required fields', async () => {
    const input = { name: 'Test App', type: 'Application' };
    const result = await service.create(input);
    expect(result.name).toBe('Test App');
    expect(result.status).toBe('ACTIVE');
  });

  it('should reject duplicate externalId', async () => {
    await service.create({ name: 'App1', type: 'Application', externalId: 'EXT-001' });
    await expect(
      service.create({ name: 'App2', type: 'Application', externalId: 'EXT-001' })
    ).rejects.toThrow('DUPLICATE_EXTERNAL_ID');
  });
});
```

### 17.2 E2E Tests

```typescript
// graphql.e2e-spec.ts
describe('GraphQL API (e2e)', () => {
  it('should query all fact sheets with pagination', async () => {
    const response = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          query {
            allFactSheets(first: 10) {
              totalCount
              edges { node { id name } cursor }
              pageInfo { hasNextPage endCursor }
            }
          }
        `
      });

    expect(response.status).toBe(200);
    expect(response.body.data.allFactSheets.edges).toHaveLength(10);
    expect(response.body.data.allFactSheets.pageInfo.hasNextPage).toBe(true);
  });
});
```

### 17.3 Integration Tests

```typescript
// ldif-processor.spec.ts
describe('LDIF Processor', () => {
  it('should process LDIF and create fact sheets', async () => {
    const ldif = {
      connectorType: 'test',
      connectorId: 'test-1',
      connectorVersion: '1.0.0',
      lxVersion: '1.0.0',
      processingDirection: 'inbound',
      processingMode: 'partial',
      content: [
        { type: 'Application', id: 'SRC-001', data: { name: 'Test App', externalId: 'EXT-001' } }
      ]
    };

    const run = await processor.process(ldif);
    expect(run.status).toBe('FINISHED');
    expect(run.createdCount).toBe(1);
  });
});
```

---

## Appendix A: Complete GraphQL Schema

```graphql
# --- Scalars -------------------------------------------------

scalar DateTime
scalar JSON

# --- Enums ---------------------------------------------------

enum FactSheetStatus {
  ACTIVE
  ARCHIVED
}

enum QualitySeal {
  BROKEN
  APPROVED
}

enum SubscriptionType {
  RESPONSIBLE
  ACCOUNTABLE
  OBSERVER
}

enum SyncRunStatus {
  CREATED
  RUNNING
  FINISHED
  FAILED
  CANCELLED
}

# --- Inputs --------------------------------------------------

input BaseFactSheetInput {
  name: String!
  type: String!
  description: String
  externalId: String
  tags: [TagInput]
  subscriptions: [SubscriptionInput]
}

input TagInput {
  name: String!
  group: TagGroupInput
}

input TagGroupInput {
  name: String!
}

input SubscriptionInput {
  user: UserInput!
  type: SubscriptionType!
  roles: [String]
}

input UserInput {
  id: ID
  email: String
  name: String
}

input FilterInput {
  factSheetType: String
  status: FactSheetStatus
  fieldFilters: [FieldFilterInput]
  relationFilters: [RelationFilterInput]
}

input FieldFilterInput {
  key: String!
  values: [String]!
  operator: FilterOperator = EQUALS
}

enum FilterOperator {
  EQUALS
  CONTAINS
  STARTS_WITH
  ENDS_WITH
  IN
  NOT_IN
}

input RelationFilterInput {
  relationType: String!
  targetType: String
  targetId: ID
}

input SortInput {
  mode: SortMode = BY_FIELD
  key: String
  direction: SortDirection = ASC
}

enum SortMode {
  BY_FIELD
  BY_NAME
  BY_UPDATED_AT
}

enum SortDirection {
  ASC
  DESC
}

input Patch {
  op: PatchOperation!
  path: String!
  value: JSON
}

enum PatchOperation {
  add
  replace
  remove
}

# --- Types ---------------------------------------------------

type FactSheet {
  id: ID!
  name: String!
  type: String!
  description: String
  displayName: String!
  externalId: String
  lifecycle: Lifecycle
  qualitySeal: QualitySeal!
  completion: Float!
  status: FactSheetStatus!
  trashBin: Boolean!
  archivedAt: DateTime
  autoDeleteAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: String!
  updatedBy: String!
  tags: [Tag!]!
  subscriptions: [Subscription!]!
  attributes: [AttributeValue!]!
  relations: [Relation!]!
}

type Lifecycle {
  asString: String
  phases: [LifecyclePhase!]!
}

type LifecyclePhase {
  phase: String!
  startDate: DateTime
}

type Tag {
  id: ID!
  name: String!
  group: TagGroup!
  color: String
}

type TagGroup {
  id: ID!
  name: String!
  description: String
  color: String
}

type Subscription {
  id: ID!
  user: User!
  type: SubscriptionType!
  roles: [String!]!
}

type User {
  id: ID!
  name: String!
  email: String!
}

type AttributeValue {
  id: ID!
  attribute: Attribute!
  value: JSON!
}

type Attribute {
  id: ID!
  technicalKey: String!
  label: String!
  description: String
  dataType: String!
  mandatory: Boolean!
  hidden: Boolean!
  readOnly: Boolean!
  allowedValues: [AllowedValue!]!
}

type AllowedValue {
  id: ID!
  value: String!
  label: String!
  color: String
}

type Relation {
  id: ID!
  relationType: RelationType!
  source: FactSheet!
  target: FactSheet!
  description: String
}

type RelationType {
  id: ID!
  technicalKey: String!
  label: String!
  description: String
  sourceType: FactSheetType!
  targetType: FactSheetType!
  cardinality: String!
  mandatory: Boolean!
}

type FactSheetType {
  id: ID!
  technicalKey: String!
  label: String!
  description: String
  icon: String
  color: String
  enabled: Boolean!
  fields: [Attribute!]!
  relations: [RelationType!]!
}

# --- Connection Types (Relay) --------------------------------

type FactSheetConnection {
  totalCount: Int!
  edges: [FactSheetEdge!]!
  pageInfo: PageInfo!
}

type FactSheetEdge {
  node: FactSheet!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type SearchConnection {
  totalCount: Int!
  edges: [SearchEdge!]!
  pageInfo: PageInfo!
}

type SearchEdge {
  node: SearchResult!
  cursor: String!
}

type SearchResult {
  id: ID!
  name: String!
  type: String!
  description: String
  highlight: String
}

# --- Queries -------------------------------------------------

type Query {
  factSheet(id: ID!): FactSheet
  allFactSheets(
    filter: FilterInput
    sort: SortInput
    first: Int
    after: String
  ): FactSheetConnection!
  search(query: String!, first: Int, after: String): SearchConnection!
  allFactSheetTypes: [FactSheetType!]!
  factSheetType(technicalKey: String!): FactSheetType
}

# --- Mutations -----------------------------------------------

type Mutation {
  createFactSheet(input: BaseFactSheetInput!): FactSheetPayload!
  updateFactSheet(id: ID!, patches: [Patch!]!): FactSheetPayload!
  archiveFactSheet(id: ID!): FactSheetPayload!
  reviveFactSheet(id: ID!): FactSheetPayload!
  deleteFactSheet(id: ID!): DeletePayload!
}

type FactSheetPayload {
  factSheet: FactSheet
  errors: [Error!]
}

type DeletePayload {
  id: ID!
  success: Boolean!
}

type Error {
  message: String!
  code: String
  path: String
}
```

---

## Appendix B: LDIF Examples

### B.1 Simple Application Import

```json
{
  "connectorType": "csv-import",
  "connectorId": "csv-001",
  "connectorVersion": "1.0.0",
  "lxVersion": "1.0.0",
  "processingDirection": "inbound",
  "processingMode": "partial",
  "description": "Import applications from CSV",
  "content": [
    {
      "type": "Application",
      "id": "APP-001",
      "data": {
        "name": "SAP CRM",
        "externalId": "SAP-CRM-001",
        "description": "Customer relationship management system",
        "lifecycle": {
          "asString": "active",
          "phases": [
            { "phase": "plan", "startDate": "2020-01-01" },
            { "phase": "phaseIn", "startDate": "2021-01-01" },
            { "phase": "active", "startDate": "2022-01-01" }
          ]
        }
      }
    },
    {
      "type": "Application",
      "id": "APP-002",
      "data": {
        "name": "Salesforce",
        "externalId": "SF-001",
        "description": "Sales force automation"
      }
    }
  ]
}
```

### B.2 With Relations

```json
{
  "connectorType": "cmdb-sync",
  "connectorId": "cmdb-prod",
  "connectorVersion": "2.1.0",
  "lxVersion": "1.0.0",
  "processingDirection": "inbound",
  "processingMode": "partial",
  "description": "Sync from ServiceNow CMDB",
  "content": [
    {
      "type": "Application",
      "id": "APP-100",
      "data": {
        "name": "E-Commerce Platform",
        "externalId": "ECOM-100",
        "relApplicationToITComponent": ["ITC-200", "ITC-201"]
      }
    },
    {
      "type": "ITComponent",
      "id": "ITC-200",
      "data": {
        "name": "AWS EC2 Instance",
        "externalId": "AWS-EC2-001"
      }
    },
    {
      "type": "ITComponent",
      "id": "ITC-201",
      "data": {
        "name": "PostgreSQL Database",
        "externalId": "PG-001"
      }
    }
  ]
}
```

### B.3 Full Mode (Replace All)

```json
{
  "connectorType": "full-sync",
  "connectorId": "master-data",
  "connectorVersion": "1.0.0",
  "lxVersion": "1.0.0",
  "processingDirection": "inbound",
  "processingMode": "full",
  "description": "Full replacement sync",
  "content": [
    {
      "type": "Application",
      "id": "APP-001",
      "data": {
        "name": "Updated Name",
        "externalId": "EXT-001"
      }
    }
  ]
}
```

**Note:** In full mode, any existing fields on the fact sheet (e.g., description, tags) that are NOT in the LDIF will be removed.

---

## Appendix C: Webhook Payload Examples

### C.1 FACT_SHEET_CREATED

```json
{
  "eventType": "FACT_SHEET_CREATED",
  "factSheet": {
    "id": "fs-new123",
    "type": "Application",
    "name": "New Application",
    "externalId": "EXT-NEW-001"
  },
  "user": {
    "id": "user-001",
    "name": "John Doe",
    "email": "john.doe@example.com"
  },
  "workspace": {
    "id": "ws-001",
    "name": "development"
  },
  "timestamp": "2026-08-25T10:30:00.000Z",
  "changes": []
}
```

### C.2 FACT_SHEET_UPDATED

```json
{
  "eventType": "FACT_SHEET_UPDATED",
  "factSheet": {
    "id": "fs-abc123",
    "type": "Application",
    "name": "Updated Application Name",
    "externalId": "EXT-001"
  },
  "user": {
    "id": "user-001",
    "name": "John Doe",
    "email": "john.doe@example.com"
  },
  "workspace": {
    "id": "ws-001",
    "name": "development"
  },
  "timestamp": "2026-08-25T10:35:00.000Z",
  "changes": [
    {
      "field": "name",
      "oldValue": "Old Application Name",
      "newValue": "Updated Application Name"
    },
    {
      "field": "description",
      "oldValue": "Old description",
      "newValue": "Updated description"
    }
  ]
}
```

### C.3 FACT_SHEET_ARCHIVED

```json
{
  "eventType": "FACT_SHEET_ARCHIVED",
  "factSheet": {
    "id": "fs-old456",
    "type": "Application",
    "name": "Legacy System",
    "externalId": "LEG-001"
  },
  "user": {
    "id": "user-002",
    "name": "Jane Smith",
    "email": "jane.smith@example.com"
  },
  "workspace": {
    "id": "ws-001",
    "name": "development"
  },
  "timestamp": "2026-08-25T10:40:00.000Z",
  "changes": [
    {
      "field": "status",
      "oldValue": "ACTIVE",
      "newValue": "ARCHIVED"
    }
  ]
}
```

### C.4 RELATION_CREATED

```json
{
  "eventType": "RELATION_CREATED",
  "factSheet": {
    "id": "fs-app123",
    "type": "Application",
    "name": "E-Commerce Platform",
    "externalId": "ECOM-100"
  },
  "relation": {
    "id": "rel-789",
    "type": "relApplicationToITComponent",
    "target": {
      "id": "fs-it456",
      "type": "ITComponent",
      "name": "AWS EC2 Instance",
      "externalId": "AWS-EC2-001"
    }
  },
  "user": {
    "id": "user-001",
    "name": "John Doe",
    "email": "john.doe@example.com"
  },
  "workspace": {
    "id": "ws-001",
    "name": "development"
  },
  "timestamp": "2026-08-25T10:45:00.000Z",
  "changes": []
}
```

---

## Appendix D: Prisma Schema (Complete)

```prisma
// packages/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// --- Meta Model --------------------------------------------

model FactSheetType {
  id            String   @id @default(cuid())
  technicalKey  String   @unique @map("technical_key")
  label         String
  description   String?
  icon          String?
  color         String?
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  attributes    Attribute[]
  factSheets    FactSheet[]
  relationsAsSource RelationType[] @relation("SourceType")
  relationsAsTarget RelationType[] @relation("TargetType")

  @@map("fact_sheet_types")
}

model Attribute {
  id            String   @id @default(cuid())
  technicalKey  String   @map("technical_key")
  label         String
  description   String?
  dataType      String   @map("data_type")
  factSheetTypeId String @map("fact_sheet_type_id")
  factSheetType   FactSheetType @relation(fields: [factSheetTypeId], references: [id])
  mandatory     Boolean  @default(false)
  hidden        Boolean  @default(false)
  readOnly      Boolean  @default(false) @map("read_only")

  allowedValues AllowedValue[]
  attributeValues AttributeValue[]

  @@unique([factSheetTypeId, technicalKey])
  @@map("attributes")
}

model AllowedValue {
  id          String   @id @default(cuid())
  value       String
  label       String
  color       String?
  attributeId String   @map("attribute_id")
  attribute   Attribute @relation(fields: [attributeId], references: [id])

  @@map("allowed_values")
}

model RelationType {
  id            String   @id @default(cuid())
  technicalKey  String   @map("technical_key")
  label         String
  description   String?
  sourceTypeId  String   @map("source_type_id")
  sourceType    FactSheetType @relation("SourceType", fields: [sourceTypeId], references: [id])
  targetTypeId  String   @map("target_type_id")
  targetType    FactSheetType @relation("TargetType", fields: [targetTypeId], references: [id])
  cardinality   String   @default("MANY_TO_MANY")
  mandatory     Boolean  @default(false)

  relations     Relation[]

  @@unique([sourceTypeId, targetTypeId, technicalKey])
  @@map("relation_types")
}

// --- Fact Sheets -------------------------------------------

model FactSheet {
  id            String   @id @default(cuid())
  typeId        String   @map("type_id")
  type          FactSheetType @relation(fields: [typeId], references: [id])
  name          String
  description   String?
  externalId    String?  @map("external_id")
  displayName   String   @map("display_name")

  lifecycle     Json?

  qualitySeal   String   @default("BROKEN") @map("quality_seal")
  completion    Float    @default(0.0)

  status        String   @default("ACTIVE")
  trashBin      Boolean  @default(false) @map("trash_bin")
  archivedAt    DateTime? @map("archived_at")
  autoDeleteAt  DateTime? @map("auto_delete_at")

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  createdBy     String   @map("created_by")
  updatedBy     String   @map("updated_by")

  attributes    AttributeValue[]
  tags          TagAssignment[]
  subscriptions Subscription[]

  sourceRelations Relation[] @relation("SourceFactSheet")
  targetRelations Relation[] @relation("TargetFactSheet")

  syncMappings  SyncMapping[]
  syncLogs      SyncLog[]

  @@index([typeId])
  @@index([externalId])
  @@index([status])
  @@index([trashBin])
  @@map("fact_sheets")
}

model AttributeValue {
  id            String   @id @default(cuid())
  factSheetId   String   @map("fact_sheet_id")
  factSheet     FactSheet @relation(fields: [factSheetId], references: [id], onDelete: Cascade)
  attributeId   String   @map("attribute_id")
  attribute     Attribute @relation(fields: [attributeId], references: [id])
  value         Json

  @@unique([factSheetId, attributeId])
  @@map("attribute_values")
}

model Relation {
  id            String   @id @default(cuid())
  relationTypeId String  @map("relation_type_id")
  relationType   RelationType @relation(fields: [relationTypeId], references: [id])

  sourceId      String   @map("source_id")
  source        FactSheet @relation("SourceFactSheet", fields: [sourceId], references: [id])
  targetId      String   @map("target_id")
  target        FactSheet @relation("TargetFactSheet", fields: [targetId], references: [id])

  description   String?

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@unique([relationTypeId, sourceId, targetId])
  @@map("relations")
}

// --- Tags --------------------------------------------------

model TagGroup {
  id            String   @id @default(cuid())
  name          String   @unique
  description   String?
  color         String?
  tags          Tag[]

  @@map("tag_groups")
}

model Tag {
  id            String   @id @default(cuid())
  name          String
  groupId       String   @map("group_id")
  group         TagGroup @relation(fields: [groupId], references: [id])
  color         String?

  assignments   TagAssignment[]

  @@unique([groupId, name])
  @@map("tags")
}

model TagAssignment {
  id            String   @id @default(cuid())
  factSheetId   String   @map("fact_sheet_id")
  factSheet     FactSheet @relation(fields: [factSheetId], references: [id], onDelete: Cascade)
  tagId         String   @map("tag_id")
  tag           Tag @relation(fields: [tagId], references: [id])

  @@unique([factSheetId, tagId])
  @@map("tag_assignments")
}

// --- Subscriptions -----------------------------------------

model Subscription {
  id            String   @id @default(cuid())
  factSheetId   String   @map("fact_sheet_id")
  factSheet     FactSheet @relation(fields: [factSheetId], references: [id], onDelete: Cascade)
  userId        String   @map("user_id")
  userName      String   @map("user_name")
  userEmail     String   @map("user_email")
  type          String
  roles         String[]

  @@unique([factSheetId, userId, type])
  @@map("subscriptions")
}

// --- Trash Bin ---------------------------------------------

model TrashBinEntry {
  id            String   @id @default(cuid())
  factSheetId   String   @unique @map("fact_sheet_id")
  factSheetType String   @map("fact_sheet_type")
  name          String
  externalId    String?  @map("external_id")
  archivedAt    DateTime @map("archived_at")
  autoDeleteAt  DateTime @map("auto_delete_at")
  deletedAt     DateTime? @map("deleted_at")

  @@index([autoDeleteAt])
  @@map("trash_bin")
}

// --- Sync & Integration ------------------------------------

model SyncMapping {
  id              String   @id @default(cuid())
  sourceSystem    String   @map("source_system")
  sourceRecordId  String   @map("source_record_id")
  factSheetId     String   @map("fact_sheet_id")
  factSheet       FactSheet @relation(fields: [factSheetId], references: [id])
  factSheetType   String   @map("fact_sheet_type")
  lastSyncedAt    DateTime @map("last_synced_at")
  syncHash        String   @map("sync_hash")
  status          String   @default("ACTIVE")

  @@unique([sourceSystem, sourceRecordId])
  @@index([factSheetId])
  @@map("sync_mappings")
}

model SyncRun {
  id              String   @id @default(cuid())
  connectorType   String   @map("connector_type")
  connectorId     String   @map("connector_id")
  connectorVersion String  @map("connector_version")
  status          String   @default("CREATED")
  startedAt       DateTime? @map("started_at")
  finishedAt      DateTime? @map("finished_at")
  errorCount      Int      @default(0) @map("error_count")
  warningCount    Int      @default(0) @map("warning_count")
  processedCount  Int      @default(0) @map("processed_count")
  createdCount    Int      @default(0) @map("created_count")
  updatedCount    Int      @default(0) @map("updated_count")
  deletedCount    Int      @default(0) @map("deleted_count")

  logs            SyncLog[]

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("sync_runs")
}

model SyncLog {
  id              String   @id @default(cuid())
  syncRunId       String   @map("sync_run_id")
  syncRun         SyncRun  @relation(fields: [syncRunId], references: [id], onDelete: Cascade)
  factSheetId     String?  @map("fact_sheet_id")
  factSheet       FactSheet? @relation(fields: [factSheetId], references: [id])
  level           String
  message         String
  details         Json?
  sourceRecordId  String?  @map("source_record_id")

  createdAt       DateTime @default(now()) @map("created_at")

  @@index([syncRunId])
  @@index([level])
  @@map("sync_logs")
}

// --- Webhooks ----------------------------------------------

model Webhook {
  id              String   @id @default(cuid())
  url             String
  events          String[]
  secret          String?
  active          Boolean  @default(true)
  workspaceId     String   @map("workspace_id")

  deliveries      WebhookDelivery[]

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("webhooks")
}

model WebhookDelivery {
  id              String   @id @default(cuid())
  webhookId       String   @map("webhook_id")
  webhook         Webhook  @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  eventType       String   @map("event_type")
  payload         Json
  responseStatus  Int?     @map("response_status")
  responseBody    String?  @map("response_body")
  success         Boolean  @default(false)
  errorMessage    String?  @map("error_message")
  attemptCount    Int      @default(1) @map("attempt_count")
  nextRetryAt     DateTime? @map("next_retry_at")

  createdAt       DateTime @default(now()) @map("created_at")
  completedAt     DateTime? @map("completed_at")

  @@index([webhookId])
  @@index([success])
  @@index([nextRetryAt])
  @@map("webhook_deliveries")
}

// --- Users & Workspace -------------------------------------

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  role          String   @default("MEMBER")
  workspaceId   String   @map("workspace_id")
  apiToken      String?  @unique @map("api_token")
  apiTokenSecret String? @map("api_token_secret")

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("users")
}

model Workspace {
  id            String   @id @default(cuid())
  name          String   @unique
  displayName   String   @map("display_name")
  description   String?

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("workspaces")
}
```

---

## Appendix E: Docker Compose Configuration

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=development
      - PORT=4000
      - DATABASE_URL=postgresql://leanix:leanix@postgres:5432/leanix_mock?schema=public
      - REDIS_URL=redis://redis:6379/0
      - LEANIX_MODE=mock
      - LEANIX_SUBDOMAIN=mock
      - LEANIX_WORKSPACE=development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ../apps/api:/app/apps/api
      - ../packages:/app/packages
    command: npm run start:dev

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: leanix
      POSTGRES_PASSWORD: leanix
      POSTGRES_DB: leanix_mock
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U leanix -d leanix_mock"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  admin-ui:
    build:
      context: ..
      dockerfile: docker/Dockerfile.admin-ui
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:4000
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

---

## Appendix F: Makefile Commands

```makefile
# Makefile

.PHONY: setup dev test migrate seed clean

setup:
	cp .env.mock .env
	docker-compose -f docker/docker-compose.yml up -d postgres redis
	sleep 5
	cd packages/prisma && npx prisma migrate dev
	cd packages/prisma && npx prisma db seed

dev:
	docker-compose -f docker/docker-compose.yml up -d
	cd apps/api && npm run start:dev

test:
	cd apps/api && npm run test
	cd apps/api && npm run test:e2e

migrate:
	cd packages/prisma && npx prisma migrate dev

seed:
	cd packages/prisma && npx prisma db seed

clean:
	docker-compose -f docker/docker-compose.yml down -v
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-25 | AI Assistant | Initial specification based on validated LeanIX research |

**Validation Status:** Research validated against official SAP LeanIX documentation (help.sap.com), community forums, and GitHub resources as of 2026-08-25.