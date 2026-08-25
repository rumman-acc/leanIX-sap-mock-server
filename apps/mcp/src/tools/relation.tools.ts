import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { LeanIxClient } from '../leanix-client';

interface RelationNode {
  id: string;
  relationType: { technicalKey: string; label: string };
  source: { id: string; name: string; type: string };
  target: { id: string; name: string; type: string };
}

interface FactSheetWithRelations {
  id: string;
  name: string;
  type: string;
  relations: RelationNode[];
}

async function fetchFactSheetWithRelations(client: LeanIxClient, id: string): Promise<FactSheetWithRelations | null> {
  const data = await client.graphql<{ factSheet: FactSheetWithRelations | null }>(
    `query($id: ID!) { factSheet(id: $id) { id name type relations { id relationType { technicalKey label } source { id name type } target { id name type } } } }`,
    { id },
  );
  return data.factSheet;
}

export function registerRelationTools(server: McpServer, client: LeanIxClient): void {
  server.registerTool(
    'get_relations',
    {
      title: 'Get relations',
      description: 'Explore the direct relationships (both directions) of a fact sheet.',
      inputSchema: {
        id: z.string().describe('Fact sheet id'),
        relationType: z.string().optional().describe('Restrict to a specific relation type technical key'),
      },
    },
    async ({ id, relationType }) => {
      const factSheet = await fetchFactSheetWithRelations(client, id);
      if (!factSheet) {
        return { content: [{ type: 'text', text: `No fact sheet found with id "${id}"` }], isError: true };
      }

      const relations = relationType
        ? factSheet.relations.filter((r) => r.relationType.technicalKey === relationType)
        : factSheet.relations;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ factSheet: { id: factSheet.id, name: factSheet.name, type: factSheet.type }, relations }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    'explain_architecture',
    {
      title: 'Explain architecture',
      description:
        'Return the dependency graph (direct + one hop of indirect relations) around a fact sheet, structured so an AI client can reason over it and explain the architecture in natural language. This tool returns data, not prose — the calling model produces the explanation.',
      inputSchema: {
        id: z.string().describe('Fact sheet id to center the analysis on'),
        depth: z.number().int().min(1).max(2).optional().default(1),
      },
    },
    async ({ id, depth }) => {
      const root = await fetchFactSheetWithRelations(client, id);
      if (!root) {
        return { content: [{ type: 'text', text: `No fact sheet found with id "${id}"` }], isError: true };
      }

      const visited = new Set<string>([id]);
      const neighborIds = new Set<string>();
      for (const r of root.relations) {
        const other = r.source.id === id ? r.target : r.source;
        neighborIds.add(other.id);
      }

      const secondHop: Record<string, FactSheetWithRelations> = {};
      if (depth >= 2) {
        for (const neighborId of neighborIds) {
          if (visited.has(neighborId)) continue;
          const neighbor = await fetchFactSheetWithRelations(client, neighborId);
          if (neighbor) secondHop[neighborId] = neighbor;
          visited.add(neighborId);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                root: { id: root.id, name: root.name, type: root.type },
                directRelations: root.relations,
                secondHopRelations: depth >= 2 ? secondHop : undefined,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
