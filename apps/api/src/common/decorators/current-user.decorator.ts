import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtClaims } from '@leanix-mock/shared';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): JwtClaims => {
  if (context.getType<'graphql'>() === 'graphql') {
    const gqlContext = GqlExecutionContext.create(context).getContext();
    return gqlContext.req.user;
  }
  const request = context.switchToHttp().getRequest();
  return request.user;
});
