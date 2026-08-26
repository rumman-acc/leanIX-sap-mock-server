import { Body, Controller, Headers, HttpCode, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { TokenRequestDto, TokenResponseDto } from '../rest/dto/token-request.dto';

interface TokenRequestBody {
  grant_type?: string;
  client_id?: string;
  client_secret?: string;
}

const BASIC_AUTH_USERNAME = 'apitoken';

@ApiTags('Authentication (MTM)')
@Controller('services/mtm/v1/oauth2')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Exchange credentials for a JWT access token',
    description:
      'Two supported credential forms: (1) real-LeanIX-matching HTTP Basic auth — username ' +
      '"apitoken", password = a single registered API Token (e.g. `curl -u apitoken:<TOKEN> ' +
      '--data grant_type=client_credentials`); or (2) this mock\'s convenience form — ' +
      'client_id/client_secret as form body fields (not supported by real LeanIX — see ' +
      'docs/RESEARCH_LEANIX_REAL_API.md). Both validate against the same registered technical ' +
      'user; use form (1) if you want your integration to work unchanged against real LeanIX.',
  })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiHeader({ name: 'Authorization', required: false, description: 'Basic <base64(apitoken:API_TOKEN)> — real LeanIX auth method' })
  @ApiBody({ type: TokenRequestDto, description: 'grant_type is always required; client_id/client_secret only for the mock-convenience form' })
  @ApiResponse({ status: 200, description: 'Token issued', type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid client credentials' })
  async token(
    @Body() body: TokenRequestBody,
    @Headers('authorization') authorizationHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { grant_type, client_id, client_secret } = body ?? {};

    if (grant_type !== 'client_credentials') {
      res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only grant_type=client_credentials is supported',
      });
      return;
    }

    const user = await this.resolveUser(authorizationHeader, client_id, client_secret);

    if (!user) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed',
      });
      return;
    }

    const tokenResponse = this.authService.issueToken(user);
    res.status(200).json(tokenResponse);
  }

  /** Real LeanIX form (HTTP Basic) takes priority; falls back to the mock-only body form. */
  private async resolveUser(authorizationHeader: string | undefined, clientId?: string, clientSecret?: string) {
    const basicCredentials = this.parseBasicAuth(authorizationHeader);
    if (basicCredentials) {
      if (basicCredentials.username !== BASIC_AUTH_USERNAME) {
        return null;
      }
      return this.authService.validateApiToken(basicCredentials.password);
    }

    if (clientId && clientSecret) {
      return this.authService.validateClientCredentials(clientId, clientSecret);
    }

    return null;
  }

  private parseBasicAuth(header: string | undefined): { username: string; password: string } | null {
    if (!header?.toLowerCase().startsWith('basic ')) {
      return null;
    }
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex === -1) return null;
      return { username: decoded.slice(0, separatorIndex), password: decoded.slice(separatorIndex + 1) };
    } catch {
      return null;
    }
  }
}
