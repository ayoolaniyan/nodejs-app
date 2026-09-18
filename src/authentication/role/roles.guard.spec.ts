import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from './enums/role.enum';

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function requireRoles(...roles: Role[]) {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  }

  it('allows a handler with no @Roles decorator', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextWith({}))).toBe(true);
  });

  it('allows a principal holding the required role', () => {
    requireRoles(Role.ADMIN);
    expect(guard.canActivate(contextWith({ user: { role: 'ADMIN' } }))).toBe(
      true,
    );
  });

  it('denies a principal without the required role', () => {
    requireRoles(Role.ADMIN);
    expect(guard.canActivate(contextWith({ user: { role: 'USER' } }))).toBe(
      false,
    );
  });

  it('ignores a role supplied in the request body', () => {
    // The earlier implementation read the role from the body, so this
    // request would have been granted admin access on the client's say-so.
    requireRoles(Role.ADMIN);
    const request = { user: { role: 'USER' }, body: { role: 'ADMIN' } };
    expect(guard.canActivate(contextWith(request))).toBe(false);
  });

  it('denies an unauthenticated request', () => {
    requireRoles(Role.USER);
    expect(guard.canActivate(contextWith({}))).toBe(false);
  });
});
