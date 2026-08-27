import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { LeanIxClient } from '../leanix-client';

const FULL_FACT_SHEET_FIELDS = `
  id name type description displayName externalId status qualitySeal completion
  createdAt updatedAt createdBy updatedBy
  lifecycle { asString phases { phase startDate } }
  tags { id name group { name } }
  subscriptions { id type roles user { name email } }
  attributes { attribute { technicalKey label } value }
  relations { id relationType { technicalKey label } source { id name type } target { id name type } }
`;

export function registerFactSheetTools(server: McpServer, client: LeanIxClient): void {
  server.registerTool(
    'get_fact_sheet',
    {
      title: 'Get fact sheet',
      description: 'Retrieve full details of a single fact sheet by id, including attributes, tags, subscriptions and relations.',
      inputSchema: { id: z.string().describe('Fact sheet id') },
    },
    async ({ id }) => {
      const data = await client.graphql<{ factSheet: unknown }>(
        `query($id: ID!) { factSheet(id: $id) { ${FULL_FACT_SHEET_FIELDS} } }`,
        { id },
      );
      if (!data.factSheet) {
        return { content: [{ type: 'text', text: `No fact sheet found with id "${id}"` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(data.factSheet, null, 2) }] };
    },
  );

  server.registerTool(
    'create_fact_sheet',
    {
      title: 'Create fact sheet',
      description: 'Create a new fact sheet in the mock workspace.',
      inputSchema: {
        name: z.string().max(255),
        type: z.string().describe('Fact sheet type technical key, e.g. "Application"'),
        description: z.string().optional(),
        externalId: z.string().optional(),
      },
    },
    async ({ name, type, description, externalId }) => {
      const data = await client.graphql<{ createFactSheet: { factSheet: unknown } }>(
        `mutation($input: BaseFactSheetInput!) { createFactSheet(input: $input) { factSheet { ${FULL_FACT_SHEET_FIELDS} } } }`,
        { input: { name, type, description, externalId } },
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.createFactSheet.factSheet, null, 2) }] };
    },
  );

  const patchSchema = z.object({
    op: z.string().describe('"add" | "replace" | "remove"'),
    path: z.string(),
    value: z.any().optional(),
  });

  // @ts-expect-error TS2589 — see the comment on search_fact_sheets in inventory.tools.ts.
  server.registerTool(
    'update_fact_sheet',
    {
      title: 'Update fact sheet',
      description:
        'Apply JSON-patch-style operations to a fact sheet (simple fields like /name or /description, or relations via /relTypeKey[/relationId]).',
      inputSchema: {
        id: z.string(),
        patches: z.array(patchSchema).min(1),
      },
    },
    async ({ id, patches }) => {
      const data = await client.graphql<{ updateFactSheet: { factSheet: unknown } }>(
        `mutation($id: ID!, $patches: [Patch!]!) { updateFactSheet(id: $id, patches: $patches) { factSheet { ${FULL_FACT_SHEET_FIELDS} } } }`,
        { id, patches },
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.updateFactSheet.factSheet, null, 2) }] };
    },
  );
}
