import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();

    // If no user attached (e.g. public route or auth failed), deny
    if (!user) {
      return false;
    }

    // Map organization-based roles to legacy roles for backward compatibility
    // This allows new JWT tokens with SUPER_ADMIN, OWNER, etc. to work with old @Roles() decorators
    const normalizeRole = (role: string): string => {
      if (!role) return '';
      
      const upperRole = role.toUpperCase();
      
      // Map organization roles to legacy roles
      if (upperRole === 'SUPER_ADMIN') return UserRole.ADMIN;
      if (upperRole === 'SUPPORT') return UserRole.SUPPORT;
      if (upperRole === 'OWNER' || upperRole === 'MANAGER' || upperRole === 'STAFF') {
        // For organization members, check organizationType from JWT
        if (user.organisationType === 'CLINIC') return UserRole.CLINIC;
        if (user.organisationType === 'MANUFACTURER') return UserRole.MANUFACTURER;
        if (user.organisationType === 'AYURLAHI_TEAM') return UserRole.ADMIN;
      }
      
      // Return as-is if already a legacy role
      return role.toLowerCase();
    };

    const userRole = normalizeRole(user.role);

    // Check if user has one of the required roles
    // Admin has access to everything
    return requiredRoles.some(
      (role) => userRole === role || userRole === UserRole.ADMIN,
    );
  }
}
