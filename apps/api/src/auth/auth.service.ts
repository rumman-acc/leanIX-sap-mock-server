import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAUTH_DEV_CLIENT_ID_PREFIX, OAUTH_DEV_CLIENT_SECRET_PREFIX } from '@leanix-mock/shared';
import { LeanIxConfig } from '../config/leanix.config';

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  scope: string;
}

const TOKEN_TTL_SECONDS = 3600;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Mock client-credentials validation. Real LeanIX validates against a registered technical
   * user; here any client_id starting with `dev-token-` and client_secret starting with
   * `dev-secret-` is accepted, always resolving to workspaceRole ADMIN (per spec 4.5).
   */
  validateClientCredentials(clientId: string, clientSecret: string): boolean {
    return (
      typeof clientId === 'string' &&
      typeof clientSecret === 'string' &&
      clientId.startsWith(OAUTH_DEV_CLIENT_ID_PREFIX) &&
      clientSecret.startsWith(OAUTH_DEV_CLIENT_SECRET_PREFIX)
    );
  }

  issueToken(clientId: string): TokenResponse {
    const config = this.configService.get<LeanIxConfig>('leanix')!;
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      sub: `technical-user-${clientId}`,
      iss: 'leanix-mock',
      aud: 'leanix-services',
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      workspaceId: 'ws-development',
      workspaceName: config.workspace,
      workspaceRole: 'ADMIN' as const,
      userName: 'technical-user@mock.local',
    };

    const access_token = this.jwtService.sign(payload, {
      secret: config.jwtSecret,
      noTimestamp: true,
    });

    return {
      access_token,
      token_type: 'bearer',
      expires_in: TOKEN_TTL_SECONDS,
      scope: '',
    };
  }
}
