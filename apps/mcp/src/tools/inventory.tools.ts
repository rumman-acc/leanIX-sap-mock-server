import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { LeanIxClient } from '../leanix-client';

const FACT_SHEET_SEARCH_FIELDS = `
  id name type description externalId status qualitySeal completion
`;

export function registerInventoryTools(server: McpServer, client: LeanIxClient): void {
  server.registerTool(
    'search_fact_sheets',
    {
      title: 'Search fact sheets',
      description: 'Search the inventory for fact sheets by free-text query, optionally filtered by type and status.',
      inputSchema: {
        query: z.string().describe('Free-text search term matched against name/description'),
        factSheetType: z.string().optional().describe('Restrict to a fact sheet type technical key, e.g. "Application"'),
        status: z.string().optional().describe('"ACTIVE" or "ARCHIVED"'),
        first: z.number().optional(),
      },
    },
    async ({ query, factSheetType, status, first }) => {
      let edges: Array<{ node: unknown }>;
      let totalCount: number;

      if (query && query.trim().length > 0) {
        const data = await client.graphql<{ search: { totalCount: number; edges: Array<{ node: unknown }> } }>(
          `query($q: String!, $first: Int) { search(query: $q, first: $first) { totalCount edges { node { id name type description highlight } } } }`,
          { q: query, first },
        );
        edges = data.search.edges;
        totalCount = data.search.totalCount;
      } else {
        const data = await client.graphql<{ allFactSheets: { totalCount: number; edges: Array<{ node: unknown }> } }>(
          `query($filter: FilterInput, $first: Int) { allFactSheets(filter: $filter, first: $first) { totalCount edges { node { ${FACT_SHEET_SEARCH_FIELDS} } } } }`,
          { filter: { factSheetType, status }, first },
        );
        edges = data.allFactSheets.edges;
        totalCount = data.allFactSheets.totalCount;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ totalCount, results: edges.map((e) => e.node) }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_meta_model',
    {
      title: 'Get meta model',
      description: 'List all available fact sheet types, their fields, and relation types defined in the workspace meta model.',
      inputSchema: {
        technicalKey: z.string().optional().describe('Return just this one fact sheet type instead of all types'),
      },
    },
    async ({ technicalKey }) => {
      if (technicalKey) {
        const data = await client.graphql(
          `query($key: String!) { factSheetType(technicalKey: $key) { technicalKey label description fields { technicalKey label dataType mandatory allowedValues { value label } } relations { technicalKey label targetType { technicalKey } cardinality } } }`,
          { key: technicalKey },
        );
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      const data = await client.graphql(
        `{ allFactSheetTypes { technicalKey label description fields { technicalKey label dataType mandatory } relations { technicalKey label targetType { technicalKey } cardinality } } }`,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    'get_reports',
    {
      title: 'List available reports',
      description:
        'List the reports available over this mock workspace\'s inventory (the mock does not implement LeanIX\'s real reporting engine; these are simple aggregate views computed on demand).',
      inputSchema: {},
    },
    async () => {
      const data = await client.graphql<{ allFactSheetTypes: Array<{ technicalKey: string; label: string }> }>(
        `{ allFactSheetTypes { technicalKey label } }`,
      );

      const reports = [
        {
          id: 'fact-sheet-count-by-type',
          name: 'Fact Sheet Count by Type',
          description: 'Number of active fact sheets per fact sheet type',
          availableFor: data.allFactSheetTypes.map((t) => t.technicalKey),
        },
        {
          id: 'completion-overview',
          name: 'Completion Overview',
          description: 'Average completion percentage across fact sheets, usable to find low-quality data',
        },
        {
          id: 'trash-bin-summary',
          name: 'Trash Bin Summary',
          description: 'Fact sheets pending permanent deletion and their auto-delete dates',
        },
      ];

      return { content: [{ type: 'text', text: JSON.stringify({ reports }, null, 2) }] };
    },
  );
}
