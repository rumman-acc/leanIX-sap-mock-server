import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { Response } from 'express';
import { LeanIxException } from '../common/exceptions/leanix.exception';
import { LeanIxConfig } from '../config/leanix.config';
import { JwtClaims } from '@leanix-mock/shared';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly configService: ConfigService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const config = this.configService.get<LeanIxConfig>('leanix')!;
    if (!config.rateLimitEnabled) {
      return next.handle();
    }

    const { request, response } = this.extractHttp(context);
    const user = request?.user as JwtClaims | undefined;

    if (!user || !response) {
      return next.handle();
    }

    const [userResult, workspaceResult] = await Promise.all([
      this.rateLimitService.checkAndIncrement(`user:${user.sub}`, config.rateLimitUserPerMinute),
      this.rateLimitService.checkAndIncrement(`workspace:${user.workspaceId}`, config.rateLimitWorkspacePerMinute),
    ]);

    response.setHeader('X-RateLimit-User-Limit', String(userResult.limit));
    response.setHeader('X-RateLimit-Workspace-Limit', String(workspaceResult.limit));

    const binding = userResult.remaining <= workspaceResult.remaining ? userResult : workspaceResult;
    response.setHeader('X-RateLimit-Limit', String(binding.limit));
    response.setHeader('X-RateLimit-Remaining', String(binding.remaining));
    response.setHeader('X-RateLimit-Reset', String(binding.resetAt));

    if (!userResult.allowed || !workspaceResult.allowed) {
      const failing = !userResult.allowed ? userResult : workspaceResult;
      response.setHeader('Retry-After', String(failing.retryAfterSeconds));
      throw new LeanIxException(
        'RATE_LIMIT_EXCEEDED',
        `You have exceeded the rate limit of ${failing.limit} requests per minute`,
        { retryAfter: failing.retryAfterSeconds },
      );
    }

    return next.handle();
  }

  private extractHttp(context: ExecutionContext): { request: any; response: Response | undefined } {
    if (context.getType<'graphql'>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context).getContext();
      return { request: gqlContext.req, response: gqlContext.res };
    }
    const httpContext = context.switchToHttp();
    return { request: httpContext.getRequest(), response: httpContext.getResponse() };
  }
}
