# SAP LeanIX — Complete Extensibility & Integration Capability Map
## Everything Available for Building Custom Applications, Agents, Workflows & Scripts

**Date:** 31 August 2026  
**Scope:** All APIs, SDKs, automation engines, integration points, and AI capabilities exposed by SAP LeanIX for custom development

---

## Table of Contents

1. [APIs — Programmatic Access](#1-apis--programmatic-access)
2. [SDKs & Development Tooling](#2-sdks--development-tooling)
3. [Built-in Automation & AI Engines](#3-built-in-automation--ai-engines)
4. [Integration Ecosystem (Out-of-the-Box)](#4-integration-ecosystem-out-of-the-box)
5. [Data Exchange & Import/Export](#5-data-exchange--importexport)
6. [Platform Features Accessible via API](#6-platform-features-accessible-via-api)
7. [What to Use for What](#7-what-to-use-for-what)

---

## 1. APIs — Programmatic Access

### 1.1 GraphQL API (Pathfinder)

| Aspect | Detail |
|--------|--------|
| **Endpoint** | `POST /services/pathfinder/v1/graphql` |
| **Purpose** | Core fact sheet CRUD, relations, attributes, tags, subscriptions |
| **Key Features** | Introspection, Relay pagination, inline fragments, patch mutations |
| **Docs** | [help.sap.com/docs/leanix/ea/graphql-api](https://help.sap.com/docs/leanix/ea/graphql-api) |
| **Explorer** | Built-in GraphiQL in workspace admin |

**Use for:** Any application that needs to read or write fact sheets, traverse relations, or discover the workspace meta model dynamically.

**Dynamic Schema:** Every workspace has a unique meta model. Concrete types extend `BaseFactSheet` and require inline fragments (`... on Application { ... }`) for type-specific fields.

---

### 1.2 REST APIs (Multiple Microservices)

SAP LeanIX exposes a wide range of REST APIs through the OpenAPI Explorer. Each is a separate microservice.

| API Service | Purpose | Docs |
|-------------|---------|------|
| **Meta Model** | Discover fact sheet types, attributes, relation types, allowed values | OpenAPI Explorer |
| **Users** | List workspace users, roles, permissions | OpenAPI Explorer |
| **Metrics** | KPIs, custom metrics, measurement data | OpenAPI Explorer |
| **Surveys** | Create, manage, and respond to surveys (v1, 30–50% faster) | [help.sap.com/docs/leanix/ea/poll-api-updates-transition-to-new-survey-api](https://help.sap.com/docs/leanix/ea/poll-api-updates-transition-to-new-survey-api) |
| **To-Do** | Create and manage action items / to-dos | OpenAPI Explorer |
| **Storage** | File/document storage and retrieval | OpenAPI Explorer |
| **Synclog** | Integration synchronization logs and audit trails | OpenAPI Explorer |
| **Transformations** | Transformation planning, impact analysis, timing | OpenAPI Explorer |
| **Impacts** | Manage timing information on transformation items | OpenAPI Explorer |
| **Webhooks** | Register, list, and manage webhook subscriptions | OpenAPI Explorer |
| **MTM** | Authentication token exchange (internal/restricted) | OpenAPI Explorer |
| **Integration Signavio** | BPM process synchronization with SAP Signavio | OpenAPI Explorer |
| **Poll** | Legacy survey backend (deprecated, transition to Survey API) | [help.sap.com/docs/leanix/ea/poll-api-updates-transition-to-new-survey-api](https://help.sap.com/docs/leanix/ea/poll-api-updates-transition-to-new-survey-api) |

**OpenAPI Explorer:** [us-2.leanix.net/openapi-explorer](https://us-2.leanix.net/openapi-explorer) or [eu.leanix.net/openapi-explorer](https://eu.leanix.net/openapi-explorer)

**SDK Generation:** All REST APIs publish OpenAPI/Swagger specs. Auto-generate SDKs in Java, C#, Python, JavaScript, PHP, Go, etc. using Swagger Codegen or OpenAPI Generator.

---

### 1.3 Integration API (LDIF)

| Aspect | Detail |
|--------|--------|
| **Format** | LDIF — LeanIX Data Interchange Format (JSON) |
| **Endpoints** | `/services/integration-api/v1/synchronizationRuns`, `/configurations`, `/withUrlInput` |
| **Purpose** | Bulk data import/export, system-to-system sync, ETL pipelines |
| **Processors** | `inboundFactSheet`, `inboundRelations`, custom data processors |
| **Docs** | [help.sap.com/docs/leanix/ea/integration-api](https://help.sap.com/docs/leanix/ea/integration-api) |
| **Examples** | [github.com/leanix-public/integration-api-examples](https://github.com/leanix-public/integration-api-examples) |
| **Ballerina Connector** | [central.ballerina.io/ballerinax/leanix.integrationapi](https://central.ballerina.io/ballerinax/leanix.integrationapi/latest) |

**Use for:** Syncing external systems (SAP, ServiceNow, CMDBs, databases) into LeanIX. LDIF is the standard for any recurring data integration.

---

### 1.4 SBOM API

| Aspect | Detail |
|--------|--------|
| **Format** | CycloneDX (OWASP standard) |
| **Purpose** | Ingest software bill of materials, discover microservices, map dependencies, track tech stacks |
| **Docs** | [help.sap.com/docs/leanix/ea/software-bill-of-materials-sbom](https://help.sap.com/docs/leanix/ea/software-bill-of-materials-sbom) |

**Use for:** CI/CD pipeline integration, vulnerability management, license compliance, software supply chain governance.

---

### 1.5 AI Agent Discovery API

| Aspect | Detail |
|--------|--------|
| **Protocol** | Agent-to-Agent (A2A) protocol |
| **Purpose** | Upload AI agent cards directly into LeanIX inventory without relying on external agent-building systems |
| **Docs** | [help.sap.com/docs/leanix/ea/ai-agent-discovery](https://help.sap.com/docs/leanix/ea/ai-agent-discovery) |
| **Upload Guide** | [help.sap.com/docs/leanix/ea/discovering-ai-agents-using-api](https://help.sap.com/docs/leanix/ea/discovering-ai-agents-using-api) |

**Use for:** Governance of in-house AI agents. Upload agent metadata, relate them to applications and business capabilities, track dependencies.

---

### 1.6 MCP Server (Model Context Protocol)

| Aspect | Detail |
|--------|--------|
| **Protocol** | MCP (Anthropic standard) |
| **Purpose** | Secure gateway for AI assistants to query LeanIX data conversationally |
| **Supported Clients** | Claude, Microsoft Copilot, SAP Joule, Cline, custom LLMs |
| **Tools** | Inventory search, reports, relation exploration, quality seal analysis, architecture guidance |
| **Docs** | [help.sap.com/docs/leanix/ea/mcp-server](https://help.sap.com/docs/leanix/ea/mcp-server) |
| **Connection** | [help.sap.com/docs/leanix/ea/connecting-to-mcp-server](https://help.sap.com/docs/leanix/ea/connecting-to-mcp-server) |
| **Open Source Plugins** | [github.com/SAP/leanix-ai-plugins](https://github.com/SAP/leanix-ai-plugins) |

**Use for:** Building AI agents that need to reason about enterprise architecture, generate reports, explore dependencies, or provide governance insights.

---

### 1.7 SCIM Provisioning API

| Aspect | Detail |
|--------|--------|
| **Standard** | SCIM 2.0 (System for Cross-domain Identity Management) |
| **Purpose** | Automated user provisioning and deprovisioning from identity providers |
| **Supported IdPs** | Microsoft Entra ID, Okta |
| **Docs** | [help.sap.com/docs/leanix/ea/scim-provisioning](https://help.sap.com/docs/leanix/ea/scim-provisioning) |
| **Entra Setup** | [help.sap.com/docs/leanix/ea/configuring-scim-in-microsoft-entra-id](https://help.sap.com/docs/leanix/ea/configuring-scim-in-microsoft-entra-id) |

**Use for:** Automating user lifecycle management — create, update, deactivate users and groups from your corporate IdP.

---

### 1.8 Webhooks API (Push Events)

| Aspect | Detail |
|--------|--------|
| **Direction** | LeanIX → Your Application |
| **Events** | Fact Sheet CRUD, relation changes, field updates, tag changes, subscription changes |
| **Delivery** | HTTP POST with HMAC-SHA256 signature, retry logic |
| **Docs** | [help.sap.com/docs/leanix/ea/webhook-events](https://help.sap.com/docs/leanix/ea/webhook-events) |
| **Payloads** | [help.sap.com/docs/leanix/ea/webhook-payloads](https://help.sap.com/docs/leanix/ea/webhook-payloads) |

**Use for:** Event-driven architecture, real-time sync, triggering external workflows, notifications.

---

## 2. SDKs & Development Tooling

### 2.1 Custom Reports SDK

| Resource | Detail |
|----------|--------|
| **What** | HTML/JS/CSS apps that run inside an iframe within LeanIX |
| **Library** | `@leanix/reporting` (npm) |
| **New CLI** | `npx @sap/create-leanix-custom-report` |
| **Communication** | postMessage between iframe and host application |
| **Docs** | [help.sap.com/docs/leanix/ea/custom-reports](https://help.sap.com/docs/leanix/ea/custom-reports) |
| **Library Repo** | [github.com/leanix/leanix-reporting](https://github.com/leanix/leanix-reporting) |
| **Tools Repo** | [github.com/SAP/leanix-custom-report-tools](https://github.com/SAP/leanix-custom-report-tools) |
| **AI Dev Guide** | `AI_AGENT_GUIDE.md` in reporting repo |

**Use for:** Embedded visualizations, dashboards, custom UI inside LeanIX, data exploration tools.

---

### 2.2 Official GitHub Repositories

| Repository | Owner | Purpose |
|------------|-------|---------|
| **leanix-ai-plugins** | SAP | AI plugins & MCP integrations |
| **leanix-self-built-software-agent** | SAP | Production AI agent (LangChain + LangGraph) |
| **leanix-custom-report-tools** | SAP | Custom report CLI & library |
| **leanix-github-agent** | SAP | GitHub Enterprise integration agent |
| **leanix-reporting** | LeanIX | Custom report library (`@leanix/reporting`) |
| **scripts** | leanix-public | Python/JS GraphQL examples |
| **integration-api-examples** | leanix-public | LDIF configs & input examples |

---

### 2.3 OpenAPI / SDK Generation

LeanIX publishes Swagger/OpenAPI specs for all REST APIs. You can auto-generate typed SDKs in any language.

**Tools:** Swagger Codegen, OpenAPI Generator, `openapi-typescript`

---

## 3. Built-in Automation & AI Engines

### 3.1 Automations (No-Code Workflow Engine)

| Aspect | Detail |
|--------|--------|
| **Model** | When → If → Then |
| **Triggers** | Fact sheet created, updated, archived, field changed, quality seal changed |
| **Actions** | Update fields, add subscriptions, send notifications, create to-dos, trigger surveys, call webhooks |
| **Scripting** | JavaScript-like custom logic for advanced automations |
| **Docs** | [help.sap.com/docs/leanix/ea/automations](https://help.sap.com/docs/leanix/ea/automations) |

**Use for:** Data quality enforcement, auto-assignment, lifecycle management, notification workflows.

---

### 3.2 AI-Assisted Automations

Describe a business rule in plain language → SAP LeanIX generates a working automation configuration using live workspace context. No JavaScript knowledge required.

---

### 3.3 AI Assistant (Built-in)

| Capability | Description |
|------------|-------------|
| **Auto-documentation** | Reads internal docs, PDFs, Confluence and updates fact sheets |
| **Report generation** | Speeds up custom report creation |
| **Architecture recommendations** | Suggests technologies and patterns based on anonymized industry benchmarks |
| **Survey generation** | Generates full survey structure from a plain-language prompt |
| **Contextual suggestions** | Pre-fills survey responses from existing data |

---

### 3.4 Semantic Search

Natural language search across the entire inventory. Understands meaning behind questions without requiring filter knowledge. Available through both the UI and the MCP server.

---

### 3.5 SAP Joule Integration

SAP's generative AI assistant integrated directly into LeanIX. Available at no additional cost via SAP for Me.

| Resource | Link |
|----------|------|
| **Joule in LeanIX** | [help.sap.com/docs/leanix/ea/joule-in-sap-leanix](https://help.sap.com/docs/leanix/ea/joule-in-sap-leanix) |
| **Joule with LeanIX** | [sap.com/products/business-transformation-management/joule-with-sap-leanix.html](https://www.sap.com/products/business-transformation-management/joule-with-sap-leanix.html) |

---

### 3.6 SAP AI Agent Hub

Vendor-agnostic command center for discovering, governing, and evaluating AI agents, MCP servers, and LLMs.

| Resource | Link |
|----------|------|
| **AI Agent Hub** | [sap.com/products/artificial-intelligence/ai-agent-hub.html](https://www.sap.com/products/artificial-intelligence/ai-agent-hub.html) |
| **Discovery Center** | [discovery-center.cloud.sap/ai-feature/afef2f21-b812-4548-ab8a-cec5f8fedb10](https://discovery-center.cloud.sap/ai-feature/afef2f21-b812-4548-ab8a-cec5f8fedb10/) |

---

## 4. Integration Ecosystem (Out-of-the-Box)

### 4.1 Discovery Integrations

| Integration | What It Discovers |
|-------------|-------------------|
| **SaaS Discovery** | Cloud applications automatically detected across your organization |
| **SAP Discovery** | SAP systems, services, and custom-built extensions |
| **SAP BTP Cloud Foundry** | Custom-built applications in CF environment |
| **SAP BTP Kyma Runtime** | Cloud-native applications and microservices |
| **SAP Build** | Projects, apps, codes, and process automation |
| **SAP Cloud ALM** | SAP cloud and on-premise applications |
| **SAP AI Core** | AI model deployments in GenAI Hub |
| **GitHub Enterprise** | Self-built software, repositories, services |
| **GitHub Agent** | Deep repository analysis, SBOM generation |
| **Microsoft Azure API Center** | MCP servers and API assets |
| **Microsoft Defender for Cloud Apps (MDCA)** | Shadow IT and cloud app usage |
| **Okta** | SaaS applications via identity data |
| **Netskope** | Cloud services and web traffic |
| **Zscaler** | Internet and cloud security traffic |
| **WalkMe** | Application usage analytics |

### 4.2 EA Toolchain Integrations

| Integration | What It Syncs |
|-------------|---------------|
| **ServiceNow** | CMDB assets, IT components, dependencies |
| **Jira Service Management** | Assets as IT components, lifecycle data |
| **SAP Signavio** | Business process models and diagrams |
| **SAP S/4HANA** | ERP applications and business capabilities |
| **SAP SuccessFactors** | Organizational entities and org charts |
| **Collibra** | Business assets and data governance |
| **Apptio** | IT financial management and cost data |

### 4.3 AI & Agent Integrations

| Integration | Purpose |
|-------------|---------|
| **MCP Server** | Connect any MCP-compatible AI assistant |
| **AI Agent Discovery API** | Upload in-house agents via A2A protocol |
| **SAP AI Agent Hub** | Discover, govern, and evaluate AI agents |
| **MCP Apps** | Packaged interaction experiences for common EA workflows |
| **Open-Source Agent Repository** | Pre-built agents and skills on top of MCP server |

---

## 5. Data Exchange & Import/Export

### 5.1 Excel Import/Export

Bulk fact sheet creation, update, and correction via Excel templates. Includes technical attribute keys and allowed values.

| Resource | Link |
|----------|------|
| **Excel Import** | [help.sap.com/docs/leanix/ea/importing-fact-sheet-data-through-excel-file](https://help.sap.com/docs/leanix/ea/importing-fact-sheet-data-through-excel-file) |

**Use for:** One-time migrations, bulk corrections, manual data exchange. **Not for automated recurring integration.**

---

### 5.2 SBOM Ingestion

Ingest CycloneDX SBOMs from CI/CD pipelines to map microservices, libraries, dependencies, and vulnerabilities.

---

### 5.3 LDIF (LeanIX Data Interchange Format)

The standard format for all automated integrations. JSON-based with required header fields and content arrays.

---

## 6. Platform Features Accessible via API

These are not separate APIs but capabilities you can manipulate through the GraphQL and REST APIs:

| Feature | What You Can Do |
|---------|-----------------|
| **Tags** | Create tag groups, assign/remove tags, filter by tags |
| **Subscriptions** | Add/remove subscribers, manage roles (RESPONSIBLE, ACCOUNTABLE, OBSERVER) |
| **Quality Seals** | Approve, break, or draft fact sheets; track data quality |
| **Comments** | Add threaded discussions to fact sheets |
| **Documents** | Attach files, link external documents |
| **To-Dos** | Create action items, assign owners, track completion |
| **Surveys** | Design questionnaires, collect responses, analyze results |
| **Metrics / KPIs** | Define custom metrics, track measurements over time |
| **Calculations** | Computed fields based on other fact sheet data |
| **Transformations** | Plan IT transformations, model impacts, track timing |
| **Impacts** | Analyze ripple effects of changes across the architecture |
| **Navigation / Portals** | Customize workspace menus and landing pages |
| **Recon / Discovery** | Trigger and monitor automated discovery scans |
| **Storage** | Upload and retrieve files associated with fact sheets |
| **Synclog** | Audit integration runs, review errors, track data lineage |

---

## 7. What to Use for What

### Building AI Agents

| Goal | Primary Tool | Secondary |
|------|-------------|-----------|
| Conversational access to LeanIX data | **MCP Server** | GraphQL API |
| Multi-agent workflows with reasoning | **LangChain + MCP** | leanix-self-built-software-agent repo |
| Governance of in-house AI agents | **AI Agent Discovery API** | AI Agent Hub |
| Pre-built agent skills | **Open-source agent repository** | leanix-ai-plugins |
| Natural language inventory search | **Semantic Search (via MCP)** | GraphQL API |

### Building Automation Workflows

| Goal | Primary Tool | Secondary |
|------|-------------|-----------|
| No-code fact sheet automation | **Automations (When/If/Then)** | — |
| Plain-language automation creation | **AI-Assisted Automations** | Automations |
| Event-driven external workflows | **Webhooks** | GraphQL subscriptions |
| Scheduled/recurring data sync | **Integration API (LDIF)** | GraphQL mutations |
| User lifecycle automation | **SCIM API** | MTM REST API |

### Building Custom Applications

| Goal | Primary Tool | Secondary |
|------|-------------|-----------|
| Embedded app inside LeanIX | **Custom Reports SDK** | Custom Report Tools CLI |
| Standalone app reading LeanIX data | **GraphQL API** | REST APIs |
| Standalone app writing LeanIX data | **GraphQL API + Integration API** | REST APIs |
| Mobile or external dashboard | **GraphQL API** | REST APIs |
| CI/CD pipeline integration | **SBOM API** | Integration API |

### Building Scripts & Utilities

| Goal | Primary Tool | Secondary |
|------|-------------|-----------|
| Python scripts for data ops | **leanix-public/scripts** | GraphQL API |
| Bulk data import/export | **Integration API (LDIF)** | Excel Import |
| API exploration & testing | **OpenAPI Explorer** | GraphiQL |
| SDK generation for any language | **OpenAPI Specs** | Swagger Codegen |

---

## Quick Reference: All Official Documentation URLs

```
SAP LeanIX APIs Overview:       https://help.sap.com/docs/leanix/ea/sap-leanix-apis
GraphQL API:                      https://help.sap.com/docs/leanix/ea/graphql-api
Integration API:                  https://help.sap.com/docs/leanix/ea/integration-api
REST APIs Overview:               https://help.sap.com/docs/leanix/ea/rest-apis-overview
REST API OpenAPI Explorer:        https://us-2.leanix.net/openapi-explorer
MCP Server:                       https://help.sap.com/docs/leanix/ea/mcp-server
MCP Connection:                   https://help.sap.com/docs/leanix/ea/connecting-to-mcp-server
Custom Reports:                   https://help.sap.com/docs/leanix/ea/custom-reports
Reporting Library & CLI:          https://help.sap.com/docs/leanix/ea/reporting-framework-and-cli
Automations:                      https://help.sap.com/docs/leanix/ea/automations
Webhooks:                         https://help.sap.com/docs/leanix/ea/webhook-events
Webhook Payloads:                 https://help.sap.com/docs/leanix/ea/webhook-payloads
Authentication:                   https://help.sap.com/docs/leanix/ea/authentication-to-sap-leanix-services
SCIM Provisioning:                https://help.sap.com/docs/leanix/ea/scim-provisioning
SBOM API:                         https://help.sap.com/docs/leanix/ea/software-bill-of-materials-sbom
AI Agent Discovery:               https://help.sap.com/docs/leanix/ea/ai-agent-discovery
Survey API (v1):                  https://help.sap.com/docs/leanix/ea/poll-api-updates-transition-to-new-survey-api
Excel Import:                     https://help.sap.com/docs/leanix/ea/importing-fact-sheet-data-through-excel-file
Joule in LeanIX:                  https://help.sap.com/docs/leanix/ea/joule-in-sap-leanix
LeanIX Integrations Hub:          https://www.leanix.net/en/enterprise-architecture/integrations
```

---

*Compiled from official SAP LeanIX documentation, OpenAPI Explorer, GitHub repositories, and SAP product announcements as of 2026-08-31.*
