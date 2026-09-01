import { UnauthorizedException } from '@nestjs/common';
import { McpServerAuthService } from '../../src/mcp-server/mcp-server-auth.service';

function buildDeps() {
  const authService = {
    validateApiToken: jest.fn(),
    issueToken: jest.fn(),
  };
  const jwtService = {
    verify: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue({ jwtSecret: 'test-secret' }),
  };
  return { authService, jwtService, configService };
}

describe('McpServerAuthService', () => {
  let deps: ReturnType<typeof buildDeps>;
  let service: McpServerAuthService;

  const claims = {
    sub: 'user-1',
    iss: 'leanix-mock',
    aud: 'leanix-services',
    iat: 0,
    exp: 0,
    workspaceId: 'ws-development',
    workspaceName: 'development',
    workspaceRole: 'ADMIN' as const,
    userName: 'user-1@mock.local',
  };

  beforeEach(() => {
    deps = buildDeps();
    service = new McpServerAuthService(deps.authService as any, deps.jwtService as any, deps.configService as any);
  });

  it('rejects a missing Authorization header', async () => {
    await expect(service.resolve(undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a header with no recognizable scheme', async () => {
    await expect(service.resolve('Basic abc123')).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid Bearer JWT as-is, without touching AuthService', async () => {
    deps.jwtService.verify.mockReturnValue(claims);

    const result = await service.resolve('Bearer some.jwt.token');

    expect(result.jwt).toBe('some.jwt.token');
    expect(result.claims).toEqual(claims);
    expect(deps.authService.validateApiToken).not.toHaveBeenCalled();
  });

  it('falls back to API-token resolution when the Bearer value is not a valid JWT', async () => {
    deps.jwtService.verify.mockImplementationOnce(() => {
      throw new Error('invalid jwt');
    });
    deps.authService.validateApiToken.mockResolvedValue({ id: 'user-1' });
    deps.authService.issueToken.mockReturnValue({ access_token: 'minted.jwt' });
    deps.jwtService.verify.mockReturnValueOnce(claims);

    const result = await service.resolve('Bearer raw-api-token');

    expect(deps.authService.validateApiToken).toHaveBeenCalledWith('raw-api-token');
    expect(result.jwt).toBe('minted.jwt');
  });

  it('resolves a Token-scheme header via AuthService', async () => {
    deps.authService.validateApiToken.mockResolvedValue({ id: 'user-1' });
    deps.authService.issueToken.mockReturnValue({ access_token: 'minted.jwt' });
    deps.jwtService.verify.mockReturnValue(claims);

    const result = await service.resolve('Token dev-token-12345');

    expect(deps.authService.validateApiToken).toHaveBeenCalledWith('dev-token-12345');
    expect(result.jwt).toBe('minted.jwt');
    expect(result.claims).toEqual(claims);
  });

  it('rejects an unregistered API token', async () => {
    deps.authService.validateApiToken.mockResolvedValue(null);

    await expect(service.resolve('Token bogus-token')).rejects.toThrow(UnauthorizedException);
  });
});
