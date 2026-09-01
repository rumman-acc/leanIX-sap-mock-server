import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtClaims } from '@leanix-mock/shared';
import { AuthService } from '../auth/auth.service';
import { LeanIxConfig } from '../config/leanix.config';

export interface McpAuthResult {
  jwt: string;
  claims: JwtClaims;
}

/**
 * Resolves the incoming MCP request's own Authorization header — real LeanIX's MCP contract
 * accepts `Token <api-token>` (technical user) or `Bearer <jwt>`, which is a different shape
 * than the rest of this mock's Bearer-JWT-only LeanIxAuthGuard, so this endpoint parses it
 * itself (registered @Public()) rather than reusing that guard. Resolution happens in-process
 * against AuthService/JwtService — no self-HTTP round trip for the auth check itself.
 */
@Injectable()
export class McpServerAuthService {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async resolve(authorizationHeader: string | undefined): Promise<McpAuthResult> {
    if (!authorizationHeader) {
      throw new UnauthorizedException('Missing Authorization header (expected "Token <api-token>" or "Bearer <jwt>")');
    }

    const [scheme, value] = authorizationHeader.split(' ');
    if (!value) {
      throw new UnauthorizedException('Malformed Authorization header');
    }

    if (scheme?.toLowerCase() === 'bearer') {
      const claims = this.tryVerifyJwt(value);
      if (claims) {
        return { jwt: value, claims };
      }
      // Mock leniency: a caller may not distinguish "Token" from "Bearer" — if it doesn't
      // verify as a JWT, try it as a raw API token instead of failing outright.
      return this.resolveApiToken(value);
    }

    if (scheme?.toLowerCase() === 'token') {
      return this.resolveApiToken(value);
    }

    throw new UnauthorizedException('Authorization scheme must be "Token" or "Bearer"');
  }

  private tryVerifyJwt(token: string): JwtClaims | null {
    const config = this.configService.get<LeanIxConfig>('leanix')!;
    try {
      return this.jwtService.verify<JwtClaims>(token, {
        secret: config.jwtSecret,
        issuer: 'leanix-mock',
        audience: 'leanix-services',
      });
    } catch {
      return null;
    }
  }

  private async resolveApiToken(apiToken: string): Promise<McpAuthResult> {
    const user = await this.authService.validateApiToken(apiToken);
    if (!user) {
      throw new UnauthorizedException('Invalid API token');
    }
    const { access_token } = this.authService.issueToken(user);
    const claims = this.tryVerifyJwt(access_token)!;
    return { jwt: access_token, claims };
  }
}
