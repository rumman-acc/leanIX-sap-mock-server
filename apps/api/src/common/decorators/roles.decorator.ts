import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '@leanix-mock/shared';

export const ROLES_KEY = 'roles';
/** Restricts an endpoint/resolver to the given workspace roles. Omit for "any authenticated role" (read access). */
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata(ROLES_KEY, roles);
