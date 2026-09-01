import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppModule } from '../../src/app.module';

/**
 * Verifies the remote Streamable HTTP MCP endpoint added to match real LeanIX's actual contract
 * (see docs/API_REFERENCE.md's MCP section, sourced from github.com/SAP/leanix-ai-plugins/blob/
 * main/MCP-SETUP.md) — a real MCP Client/StreamableHTTPClientTransport, not supertest, since the
 * point is proving an actual MCP-speaking consumer can reach this over HTTP.
 */
describe('MCP server — remote Streamable HTTP endpoint (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    // The MCP controller's tools call back into this same process at http://localhost:{config.port}
    // (see apps/api/src/mcp-server/mcp-server.controller.ts) — config.port is read from PORT at
    // module registration, so it must be set (and the app must actually listen on it) *before*
    // compiling the module. An ephemeral app.listen(0) would leave that loopback call pointed at
    // the wrong port, silently reachable only by coincidence if something else happens to be
    // listening on the default port.
    const testPort = 4099;
    process.env.PORT = String(testPort);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(testPort);
    baseUrl = `http://127.0.0.1:${testPort}`;
  });

  afterAll(async () => {
    await app.close();
    delete process.env.PORT;
  });

  function mcpUrl(query = 'toolsets=inventory') {
    return new URL(`${baseUrl}/services/mcp-server/v1/mcp?${query}`);
  }

  it('lists tools and calls one, authenticated via Authorization: Token', async () => {
    const transport = new StreamableHTTPClientTransport(mcpUrl(), {
      requestInit: { headers: { Authorization: 'Token dev-token-12345' } },
    });
    const client = new Client({ name: 'e2e-test', version: '1.0.0' });
    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['search_fact_sheets', 'get_fact_sheet', 'get_relations', 'get_meta_model']),
    );

    const result = await client.callTool({ name: 'search_fact_sheets', arguments: { query: 'SAP' } });
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('SAP CRM');

    await client.close();
  });

  it('authenticates via a Bearer JWT obtained from the normal OAuth flow', async () => {
    const tokenRes = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .auth('apitoken', 'dev-token-12345')
      .type('form')
      .send('grant_type=client_credentials');
    const jwt = tokenRes.body.access_token;

    const transport = new StreamableHTTPClientTransport(mcpUrl(), {
      requestInit: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const client = new Client({ name: 'e2e-test-bearer', version: '1.0.0' });
    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.length).toBeGreaterThan(0);

    await client.close();
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/mcp-server/v1/mcp?toolsets=inventory')
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/Authorization/);
  });

  it('rejects a request with an invalid API token', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/mcp-server/v1/mcp?toolsets=inventory')
      .set('Authorization', 'Token not-a-real-token')
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    expect(res.status).toBe(401);
  });

  it('rejects GET and DELETE with 405', async () => {
    const getRes = await request(app.getHttpServer()).get('/services/mcp-server/v1/mcp');
    expect(getRes.status).toBe(405);

    const deleteRes = await request(app.getHttpServer()).delete('/services/mcp-server/v1/mcp');
    expect(deleteRes.status).toBe(405);
  });

  it('scopes tool results to the calling token\'s workspace', async () => {
    const transport = new StreamableHTTPClientTransport(mcpUrl(), {
      requestInit: { headers: { Authorization: 'Token dev-token-acquired-11111' } },
    });
    const client = new Client({ name: 'e2e-test-ws2', version: '1.0.0' });
    await client.connect(transport);

    const result = await client.callTool({ name: 'search_fact_sheets', arguments: { query: 'SAP' } });
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('fs2-app-sap-customer-360');
    expect(text).not.toContain('fs-app-sap-crm');

    await client.close();
  });
});
