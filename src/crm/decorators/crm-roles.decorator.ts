import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';

export const CRM_ROLES_KEY = 'crm_roles';

/**
 * Restrict a CRM endpoint to specific sales roles, checked against the RAW JWT
 * role by CrmRolesGuard (not the collapsing platform RolesGuard).
 * Owner/Admin/SUPER_ADMIN always pass. See scope/Medilink_CRM_Final_Brief.md B1.
 */
export const CrmRoles = (...roles: UserRole[]) =>
  SetMetadata(CRM_ROLES_KEY, roles);
