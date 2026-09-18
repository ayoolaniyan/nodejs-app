import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './enums/role.enum';
import { ROLES_KEY } from './decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // The role is read from the authenticated principal, which comes from a
    // signed token. Reading it from the request body would let any caller
    // grant themselves a role simply by sending one.
    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) {
      return false;
    }

    return requiredRoles.includes(user.role as Role);
  }
}
