// Hand-written ambient types for @leanix-mock/mcp, standing in for tsc-emitted declarations.
//
// apps/mcp's tsconfig deliberately has "declaration": false — turning it on made its build emit
// full .d.ts output, which requires tsc to fully resolve/print inferred types for every exported
// symbol. That includes the zod-inferred tool schemas passed through @modelcontextprotocol/sdk's
// registerTool(), whose generic inference is independently known to be expensive enough to need
// its own @ts-expect-error TS2589 workarounds elsewhere in apps/mcp — that cost, multiplied across
// every tool, was enough to OOM-crash tsc on Render's memory-constrained free-tier build container
// (confirmed live: "Aborted (core dumped)" / OOMErrorHandler in the build log). This file gives
// apps/api real types for the handful of symbols it actually imports, at zero extra tsc cost.
declare module '@leanix-mock/mcp' {
  import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

  export interface LeanIxClientConfig {
    baseUrl: string;
    apiToken: string;
    apiTokenSecret: string;
    presetToken?: string;
  }

  export class LeanIxClient {
    constructor(config: LeanIxClientConfig);
  }

  export function registerInventoryTools(server: McpServer, client: LeanIxClient): void;
  export function registerFactSheetTools(server: McpServer, client: LeanIxClient): void;
  export function registerRelationTools(server: McpServer, client: LeanIxClient): void;
  export function registerWorkspaceResource(server: McpServer, client: LeanIxClient): void;
}
