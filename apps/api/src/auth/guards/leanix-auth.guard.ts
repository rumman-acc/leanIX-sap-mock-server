import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtClaims } from '@leanix-mock/shared';
import { LeanIxException } from '../../common/exceptions/leanix.exception';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { LeanIxConfig } from '../../config/leanix.config';

@Injectable()
export class LeanIxAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = this.getRequest(context);
    const token = this.extractToken(request);
    if (!token) {
      throw new LeanIxException('UNAUTHENTICATED', 'Missing bearer token');
    }

    const config = this.configService.get<LeanIxConfig>('leanix')!;
    try {
      const claims = this.jwtService.verify<JwtClaims>(token, {
        secret: config.jwtSecret,
        issuer: 'leanix-mock',
        audience: 'leanix-services',
      });
      request.user = claims;
      return true;
    } catch {
      throw new LeanIxException('UNAUTHENTICATED', 'Invalid or expired token');
    }
  }

  private getRequest(context: ExecutionContext): any {
    if (context.getType<'graphql'>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext().req;
    }
    return context.switchToHttp().getRequest();
  }

  private extractToken(request: any): string | undefined {
    const header: string | undefined = request?.headers?.authorization;
    if (!header) return undefined;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
  }
}
