import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { LeanIxException } from '../../src/common/exceptions/leanix.exception';

describe('RolesGuard', () => {
  it('allows VIEWER through a read-only REST endpoint with no explicit roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: { workspaceRole: 'VIEWER' } }) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects VIEWER from an endpoint restricted to ADMIN/MEMBER', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['ADMIN', 'MEMBER']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: { workspaceRole: 'VIEWER' } }) }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(LeanIxException);
    try {
      guard.canActivate(context);
    } catch (e) {
      expect((e as LeanIxException).code).toBe('FORBIDDEN');
    }
  });

  it('allows a public endpoint through without a user', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValueOnce(true) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
