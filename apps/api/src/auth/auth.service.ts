import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@leanix-mock/prisma';
import { WorkspaceRole } from '@leanix-mock/shared';
import { PrismaService } from '../common/prisma/prisma.service';
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
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Real LeanIX auth: HTTP Basic with username literally "apitoken" and password = a single
   * API Token generated for a technical user (no client_secret concept exists in the real
   * product — see docs/RESEARCH_LEANIX_REAL_API.md §1). This is the path a custom application
   * should actually be built against for a true domain-only swap.
   */
  async validateApiToken(apiToken: string): Promise<User | null> {
    if (!apiToken) {
      return null;
    }
    return this.prisma.user.findFirst({ where: { apiToken } });
  }

  /**
   * Mock-only convenience path (kept for backward compatibility with anything already built
   * against this mock): client_id/client_secret as form body fields, validated against the
   * same technical user's apiToken/apiTokenSecret. Real LeanIX does not support this — see
   * validateApiToken() for the contract a custom application should actually rely on.
   */
  async validateClientCredentials(clientId: string, clientSecret: string): Promise<User | null> {
    if (!clientId || !clientSecret) {
      return null;
    }
    return this.prisma.user.findFirst({
      where: { apiToken: clientId, apiTokenSecret: clientSecret },
    });
  }

  issueToken(user: User): TokenResponse {
    const config = this.configService.get<LeanIxConfig>('leanix')!;
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      sub: user.id,
      iss: 'leanix-mock',
      aud: 'leanix-services',
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      workspaceId: user.workspaceId,
      workspaceName: config.workspace,
      workspaceRole: user.role as WorkspaceRole,
      userName: user.email,
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
