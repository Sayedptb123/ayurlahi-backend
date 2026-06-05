import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CRM_ROLES_KEY } from '../decorators/crm-roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { isCrmAdminTier } from '../crm-access.util';

/**
 * Server-side access control for the Sales CRM (B1).
 *
 * Two jobs the platform RolesGuard cannot do:
 *  1. The CRM lives inside the AYURLAHI_TEAM org — non-team users are denied
 *     outright (a clinic owner must never reach the sales pipeline).
 *  2. Fine-grained intra-team roles: the platform guard collapses every team
 *     member into ADMIN, so it can't distinguish telecaller from manager.
 *     This guard matches the RAW JWT role against @CrmRoles(...).
 *
 * Owner / Admin / SUPER_ADMIN always pass (full-access tier). Row-level
 * scoping (a telecaller only sees their own leads) is enforced in the service
 * layer, not here.
 */
@Injectable()
export class CrmRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    // Gate the entire module to AYURLAHI_TEAM members. We gate on the org TYPE
    // (not the role name) because OWNER/ADMIN are generic roles that clinics
    // and manufacturers also use — a clinic owner must never reach the sales
    // pipeline. SUPER_ADMIN/SUPPORT are themselves members of the team org.
    if (user.organisationType !== 'AYURLAHI_TEAM') {
      throw new ForbiddenException('The Sales CRM is restricted to the Ayurlahi team');
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      CRM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No specific roles required → any authenticated team member may proceed.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Full-access tier bypasses role checks.
    if (isCrmAdminTier(user.role)) {
      return true;
    }

    const role = (user.role || '').toUpperCase();
    if (requiredRoles.some((r) => r === role)) {
      return true;
    }

    throw new ForbiddenException(
      'Your role does not have permission for this action',
    );
  }
}
