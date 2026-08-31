import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * Proves the multi-workspace scoping added for M&A Architecture Assessment actually isolates
 * tenants, not just that two workspaces exist — see LeanIX_Mock_UseCase_Coverage_Analysis.md §6.
 * Relies on the seeded second workspace (ws-acquired-co, packages/prisma/seed.ts) and its
 * technical user's dev-default credential.
 */
describe('Multi-workspace tenant isolation (e2e)', () => {
  let app: INestApplication;
  let tokenDevelopment: string;
  let tokenAcquiredCo: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const res1 = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .auth('apitoken', process.env.LEANIX_API_TOKEN ?? 'dev-token-12345')
      .type('form')
      .send('grant_type=client_credentials');
    tokenDevelopment = res1.body.access_token;

    const res2 = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .auth('apitoken', process.env.LEANIX_API_TOKEN_ACQUIRED ?? 'dev-token-acquired-11111')
      .type('form')
      .send('grant_type=client_credentials');
    tokenAcquiredCo = res2.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('issues tokens scoped to two different workspaces', async () => {
    expect(tokenDevelopment).toBeDefined();
    expect(tokenAcquiredCo).toBeDefined();
    expect(tokenDevelopment).not.toBe(tokenAcquiredCo);
  });

  it('each workspace sees only its own Application portfolio', async () => {
    const query = 'query { allFactSheets(filter:{facetFilters:[{facetKey:"FactSheetTypes",keys:["Application"]}]}, first: 50) { totalCount edges { node { id name } } } }';

    const devRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${tokenDevelopment}`)
      .send({ query });
    const devNames = devRes.body.data.allFactSheets.edges.map((e: any) => e.node.name);
    expect(devNames).toContain('SAP CRM');
    expect(devNames).not.toContain('SAP Customer 360');

    const acqRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${tokenAcquiredCo}`)
      .send({ query });
    const acqNames = acqRes.body.data.allFactSheets.edges.map((e: any) => e.node.name);
    expect(acqNames).toContain('SAP Customer 360');
    expect(acqNames).not.toContain('SAP CRM');
  });

  it('a workspace cannot read the other workspace\'s fact sheet by id', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${tokenAcquiredCo}`)
      .send({ query: 'query { factSheet(id: "fs-app-sap-crm") { id name } }' });

    expect(res.body.data.factSheet).toBeNull();
  });

  it('a workspace cannot create a relation targeting the other workspace\'s fact sheet', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${tokenAcquiredCo}`)
      .send({
        query:
          'mutation { upsertRelation(from: "fs2-app-online-store", to: "fs-app-sap-crm", type: "relApplicationToITComponent") { id } }',
      });

    expect(res.body.errors?.[0]?.extensions?.code).toBe('FACT_SHEET_NOT_FOUND');
  });

  it('each workspace has its own independent meta model', async () => {
    const query = 'query { factSheetType(technicalKey: "Application") { id } }';

    const devRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${tokenDevelopment}`)
      .send({ query });
    const acqRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${tokenAcquiredCo}`)
      .send({ query });

    expect(devRes.body.data.factSheetType.id).not.toBe(acqRes.body.data.factSheetType.id);
  });

  it('webhooks registered in one workspace are invisible to the other', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/services/webhooks/v1/subscriptions')
      .set('Authorization', `Bearer ${tokenDevelopment}`)
      .send({ identifier: 'multi-ws e2e hook', targetUrl: 'https://example.com/e2e-hook' });
    expect(createRes.status).toBe(201);
    const webhookId = createRes.body.data.id;

    const crossWsRead = await request(app.getHttpServer())
      .get(`/services/webhooks/v1/subscriptions/${webhookId}`)
      .set('Authorization', `Bearer ${tokenAcquiredCo}`);
    expect(crossWsRead.status).toBe(404);
  });
});
