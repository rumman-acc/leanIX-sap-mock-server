import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LeanIxClient } from './leanix-client';
import { registerInventoryTools } from './tools/inventory.tools';
import { registerFactSheetTools } from './tools/fact-sheet.tools';
import { registerRelationTools } from './tools/relation.tools';
import { registerWorkspaceResource } from './resources/workspace.resource';

async function main() {
  const client = new LeanIxClient({
    baseUrl: process.env.LEANIX_BASE_URL ?? 'http://localhost:4000',
    apiToken: process.env.LEANIX_API_TOKEN ?? 'dev-token-12345',
    apiTokenSecret: process.env.LEANIX_API_TOKEN_SECRET ?? 'dev-secret-67890',
  });

  const server = new McpServer({
    name: 'leanix-mock-mcp',
    version: '1.0.0',
  });

  registerInventoryTools(server, client);
  registerFactSheetTools(server, client);
  registerRelationTools(server, client);
  registerWorkspaceResource(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('LeanIX MCP server failed to start:', err);
  process.exit(1);
});
