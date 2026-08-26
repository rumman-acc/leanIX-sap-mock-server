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
   * Validates client_id/client_secret against an actual registered technical user's API
   * token/secret in the database — the same shape of check real LeanIX performs (a technical
   * user is created in the workspace with a specific token/secret pair; only that exact pair
   * authenticates). No prefix or pattern shortcuts: whatever credential is seeded/configured is
   * the only thing that works, same as it would be against a real workspace.
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
