import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, Server } from 'http';
import { createHmac } from 'crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

async function waitForSyncRunFinished(app: INestApplication, token: string, id: string, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await request(app.getHttpServer())
      .get(`/services/integration-api/v1/synchronizationRuns/${id}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.body.status === 'FINISHED' || res.body.status === 'FAILED') {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Sync run did not finish in time');
}

describe('Integration API + Webhooks (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let receiver: Server;
  let received: Array<{ headers: Record<string, string>; body: string }>;
  const RECEIVER_PORT = 4123;

  beforeAll(async () => {
    received = [];
    receiver = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push({ headers: req.headers as Record<string, string>, body });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => receiver.listen(RECEIVER_PORT, resolve));

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const tokenRes = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .type('form')
      // Must match the technical user actually registered by packages/prisma/seed.ts (exact
      // stored credential now, not a pattern — see apps/api/src/auth/auth.service.ts).
      .send('grant_type=client_credentials&client_id=dev-token-12345&client_secret=dev-secret-67890');
    token = tokenRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => receiver.close(() => resolve()));
  });

  it('rejects a malformed LDIF payload with INVALID_LDIF', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/integration-api/v1/synchronizationRuns')
      .set('Authorization', `Bearer ${token}`)
      .send({ connectorType: 'test' }); // missing required fields

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_LDIF');
  });

  it('returns SYNC_RUN_NOT_FOUND for an unknown sync run id', async () => {
    const res = await request(app.getHttpServer())
      .get('/services/integration-api/v1/synchronizationRuns/does-not-exist')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('SYNC_RUN_NOT_FOUND');
  });

  it('processes an inline LDIF sync run to completion and persists the fact sheet', async () => {
    const externalId = `LDIF-E2E-${Date.now()}`;
    const createRes = await request(app.getHttpServer())
      .post('/services/integration-api/v1/synchronizationRuns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        connectorType: 'test-connector',
        connectorId: `test-conn-${Date.now()}`,
        connectorVersion: '1.0.0',
        lxVersion: '1.0.0',
        processingDirection: 'inbound',
        processingMode: 'partial',
        content: [{ type: 'Application', id: 'SRC-1', data: { name: 'LDIF E2E App', externalId } }],
      });

    expect(createRes.status).toBe(202);
    expect(createRes.body.status).toBe('CREATED');

    const finished = await waitForSyncRunFinished(app, token, createRes.body.id);
    expect(finished.status).toBe('FINISHED');
    expect(finished.createdCount).toBe(1);

    const readRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `query($eid: String!) { allFactSheets(filter: { fieldFilters: [{ key: "externalId", values: [$eid] }] }) { edges { node { name externalId } } } }`,
        variables: { eid: externalId },
      });

    expect(readRes.body.data.allFactSheets.edges[0].node.name).toBe('LDIF E2E App');
  });

  it('registers a webhook subscription (real LeanIX contract: /services/webhooks/v1/subscriptions) and delivers on fact sheet creation', async () => {
    const secret = 'e2e-webhook-secret';
    const authorizationHeader = 'Bearer static-integration-token';
    const registerRes = await request(app.getHttpServer())
      .post('/services/webhooks/v1/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        identifier: 'e2e test subscription',
        targetUrl: `http://localhost:${RECEIVER_PORT}`,
        authorizationHeader,
        events: ['FACT_SHEET_CREATED'], // mock-only convenience filter
        secret, // mock-only convenience HMAC signing
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.status).toBe('OK');
    expect(registerRes.body.data.active).toBe(true);
    expect(registerRes.body.data.deliveryType).toBe('PUSH');
    const webhookId = registerRes.body.data.id;

    const getRes = await request(app.getHttpServer())
      .get(`/services/webhooks/v1/subscriptions/${webhookId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.targetUrl).toBe(`http://localhost:${RECEIVER_PORT}`);

    await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `mutation($input: BaseFactSheetInput!) { createFactSheet(input: $input) { factSheet { id } } }`,
        variables: { input: { name: 'Webhook E2E App', type: 'Application' } },
      });

    const start = Date.now();
    while (received.length === 0 && Date.now() - start < 10000) {
      await new Promise((r) => setTimeout(r, 200));
    }

    expect(received.length).toBeGreaterThan(0);
    const delivery = received[received.length - 1];
    // Real LeanIX contract: authorizationHeader sent verbatim, no payload signing.
    expect(delivery.headers['authorization']).toBe(authorizationHeader);
    // Mock-only bonus headers, kept for backward compatibility.
    expect(delivery.headers['x-leanix-event']).toBe('FACT_SHEET_CREATED');
    const expectedSignature = `sha256=${createHmac('sha256', secret).update(delivery.body).digest('hex')}`;
    expect(delivery.headers['x-leanix-signature']).toBe(expectedSignature);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/services/webhooks/v1/subscriptions/${webhookId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.id).toBe(webhookId);
  });
});
