import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('GraphQL API (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const tokenRes = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .type('form')
      .send('grant_type=client_credentials&client_id=dev-token-e2e&client_secret=dev-secret-e2e');

    expect(tokenRes.status).toBe(200);
    token = tokenRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects invalid client credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .type('form')
      .send('grant_type=client_credentials&client_id=nope&client_secret=nope');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_client');
  });

  it('rejects unauthenticated GraphQL requests', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .send({ query: '{ allFactSheets { totalCount } }' });

    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('queries all fact sheets with pagination envelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `query { allFactSheets(first: 2) { totalCount edges { node { id name } cursor } pageInfo { hasNextPage endCursor } } }`,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.allFactSheets.edges.length).toBeLessThanOrEqual(2);
    expect(typeof res.body.data.allFactSheets.totalCount).toBe('number');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });

  it('creates, reads, updates, archives and revives a fact sheet', async () => {
    const externalId = `E2E-${Date.now()}`;

    const createRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `mutation($input: BaseFactSheetInput!) { createFactSheet(input: $input) { factSheet { id name status qualitySeal } } }`,
        variables: { input: { name: 'E2E App', type: 'Application', externalId } },
      });

    expect(createRes.status).toBe(200);
    const created = createRes.body.data.createFactSheet.factSheet;
    expect(created.status).toBe('ACTIVE');
    expect(created.qualitySeal).toBe('BROKEN');

    const readRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: `query($id: ID!) { factSheet(id: $id) { id name externalId } }`, variables: { id: created.id } });

    expect(readRes.body.data.factSheet.externalId).toBe(externalId);

    const updateRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `mutation($id: ID!, $patches: [Patch!]!) { updateFactSheet(id: $id, patches: $patches) { factSheet { id name } } }`,
        variables: { id: created.id, patches: [{ op: 'replace', path: '/name', value: 'E2E App Renamed' }] },
      });

    expect(updateRes.body.data.updateFactSheet.factSheet.name).toBe('E2E App Renamed');

    const archiveRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `mutation($id: ID!) { archiveFactSheet(id: $id) { factSheet { id status trashBin } } }`,
        variables: { id: created.id },
      });

    expect(archiveRes.body.data.archiveFactSheet.factSheet.status).toBe('ARCHIVED');
    expect(archiveRes.body.data.archiveFactSheet.factSheet.trashBin).toBe(true);

    const reviveRes = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `mutation($id: ID!) { reviveFactSheet(id: $id) { factSheet { id status trashBin } } }`,
        variables: { id: created.id },
      });

    expect(reviveRes.body.data.reviveFactSheet.factSheet.status).toBe('ACTIVE');
    expect(reviveRes.body.data.reviveFactSheet.factSheet.trashBin).toBe(false);
  });

  it('supports GraphQL introspection', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/pathfinder/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: '{ __schema { queryType { name } mutationType { name } } }' });

    expect(res.body.data.__schema.queryType.name).toBe('Query');
    expect(res.body.data.__schema.mutationType.name).toBe('Mutation');
  });
});
