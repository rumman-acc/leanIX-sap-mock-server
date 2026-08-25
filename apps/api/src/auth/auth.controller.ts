import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';

interface TokenRequestBody {
  grant_type?: string;
  client_id?: string;
  client_secret?: string;
}

@Controller('services/mtm/v1/oauth2')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('token')
  @HttpCode(200)
  token(@Body() body: TokenRequestBody, @Res() res: Response): void {
    const { grant_type, client_id, client_secret } = body ?? {};

    if (grant_type !== 'client_credentials') {
      res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only grant_type=client_credentials is supported',
      });
      return;
    }

    if (!client_id || !client_secret || !this.authService.validateClientCredentials(client_id, client_secret)) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed',
      });
      return;
    }

    const tokenResponse = this.authService.issueToken(client_id);
    res.status(200).json(tokenResponse);
  }
}
