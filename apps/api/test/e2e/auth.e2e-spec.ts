import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Auth — real LeanIX HTTP Basic form (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('issues a token via HTTP Basic auth (username "apitoken", password = the registered token) — matches real LeanIX\'s documented curl flow', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .auth('apitoken', 'dev-token-12345')
      .type('form')
      .send('grant_type=client_credentials');

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.token_type).toBe('bearer');
  });

  it('rejects HTTP Basic auth with the wrong username', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .auth('not-apitoken', 'dev-token-12345')
      .type('form')
      .send('grant_type=client_credentials');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_client');
  });

  it('rejects HTTP Basic auth with an unregistered token', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .auth('apitoken', 'not-a-real-token')
      .type('form')
      .send('grant_type=client_credentials');

    expect(res.status).toBe(401);
  });

  it('still accepts the mock-only client_id/client_secret body form (backward compatible)', async () => {
    const res = await request(app.getHttpServer())
      .post('/services/mtm/v1/oauth2/token')
      .type('form')
      .send('grant_type=client_credentials&client_id=dev-token-12345&client_secret=dev-secret-67890');

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
  });
});
