import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthService', () => {
  const fakeUser = {
    id: 'user-technical',
    email: 'technical-user@mock.local',
    role: 'ADMIN',
    workspaceId: 'ws-development',
    apiToken: 'dev-token-12345',
    apiTokenSecret: 'dev-secret-67890',
  };

  function buildService(findFirstResult: unknown) {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(findFirstResult) } };
    const jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') } as unknown as JwtService;
    const configService = {
      get: jest.fn().mockReturnValue({ jwtSecret: 'test-secret', workspace: 'development' }),
    } as unknown as ConfigService;
    const service = new AuthService(jwtService, configService, prisma as any);
    return { service, prisma };
  }

  describe('validateApiToken (real LeanIX form: single token, HTTP Basic)', () => {
    it('looks up a user by apiToken only, no secret involved', async () => {
      const { service, prisma } = buildService(fakeUser);
      const result = await service.validateApiToken('dev-token-12345');
      expect(result).toBe(fakeUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { apiToken: 'dev-token-12345' } });
    });

    it('returns null for an empty token', async () => {
      const { service } = buildService(fakeUser);
      expect(await service.validateApiToken('')).toBeNull();
    });

    it('returns null when no user matches', async () => {
      const { service } = buildService(null);
      expect(await service.validateApiToken('not-a-real-token')).toBeNull();
    });
  });

  describe('validateClientCredentials (mock-only convenience form)', () => {
    it('requires both apiToken and apiTokenSecret to match', async () => {
      const { service, prisma } = buildService(fakeUser);
      const result = await service.validateClientCredentials('dev-token-12345', 'dev-secret-67890');
      expect(result).toBe(fakeUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { apiToken: 'dev-token-12345', apiTokenSecret: 'dev-secret-67890' },
      });
    });

    it('returns null when either value is missing', async () => {
      const { service } = buildService(fakeUser);
      expect(await service.validateClientCredentials('dev-token-12345', '')).toBeNull();
    });
  });

  it('issues a token with claims sourced from the real user row', () => {
    const { service } = buildService(fakeUser);
    const response = service.issueToken(fakeUser as any);
    expect(response.access_token).toBe('signed.jwt.token');
    expect(response.token_type).toBe('bearer');
    expect(response.expires_in).toBe(3600);
  });
});
