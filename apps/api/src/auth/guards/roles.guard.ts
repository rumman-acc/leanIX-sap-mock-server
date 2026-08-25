import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtClaims, WorkspaceRole } from '@leanix-mock/shared';
import { LeanIxException } from '../../common/exceptions/leanix.exception';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const explicitRoles = this.reflector.getAllAndOverride<WorkspaceRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const user = this.getUser(context);
    if (!user) {
      // LeanIxAuthGuard runs first and would already have thrown; this is a defensive fallback.
      throw new LeanIxException('UNAUTHENTICATED', 'Missing authenticated user');
    }

    const requiredRoles = explicitRoles ?? this.defaultRolesFor(context);

    if (requiredRoles && !requiredRoles.includes(user.workspaceRole)) {
      throw new LeanIxException(
        'FORBIDDEN',
        `Role ${user.workspaceRole} is not permitted to perform this action`,
      );
    }

    return true;
  }

  /** GraphQL mutations require write access (ADMIN/MEMBER); queries and REST default to read (any role). */
  private defaultRolesFor(context: ExecutionContext): WorkspaceRole[] | undefined {
    if (context.getType<'graphql'>() !== 'graphql') {
      return undefined;
    }
    const info = GqlExecutionContext.create(context).getInfo();
    if (info?.operation?.operation === 'mutation') {
      return ['ADMIN', 'MEMBER'];
    }
    return undefined;
  }

  private getUser(context: ExecutionContext): JwtClaims | undefined {
    if (context.getType<'graphql'>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext().req?.user;
    }
    return context.switchToHttp().getRequest()?.user;
  }
}
