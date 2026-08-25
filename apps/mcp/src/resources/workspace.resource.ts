import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LeanIxClient } from '../leanix-client';

export function registerWorkspaceResource(server: McpServer, client: LeanIxClient): void {
  server.registerResource(
    'workspace-summary',
    'leanix://workspace',
    {
      title: 'Workspace summary',
      description: 'Fact sheet type inventory counts for the current mock workspace',
      mimeType: 'application/json',
    },
    async (uri) => {
      const data = await client.graphql<{ allFactSheetTypes: Array<{ technicalKey: string; label: string }> }>(
        `{ allFactSheetTypes { technicalKey label } }`,
      );

      const counts = await Promise.all(
        data.allFactSheetTypes.map(async (type) => {
          const result = await client.graphql<{ allFactSheets: { totalCount: number } }>(
            `query($t: String!) { allFactSheets(filter: { factSheetType: $t }) { totalCount } }`,
            { t: type.technicalKey },
          );
          return { type: type.technicalKey, label: type.label, count: result.allFactSheets.totalCount };
        }),
      );

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ factSheetTypeCounts: counts }, null, 2),
          },
        ],
      };
    },
  );
}
