import { UserRole } from '../users/enums/user-role.enum';

/**
 * Sales CRM access tiers (B1). The platform RolesGuard collapses all
 * AYURLAHI_TEAM members into ADMIN, so it cannot tell a telecaller from a
 * sales manager. These helpers work off the RAW JWT role for fine-grained
 * intra-team access and data-scoping decisions.
 */

export interface CrmActor {
  userId: string;
  role: string;
  organisationType?: string;
}

const upper = (r?: string) => (r || '').toUpperCase();

/** Owner / Admin / SUPER_ADMIN — full visibility, export, configure stages, audit. */
export function isCrmAdminTier(role?: string): boolean {
  return [UserRole.OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(
    upper(role) as UserRole,
  );
}

/** Manager tier — all leads & staff, assign/reassign, override stages, Won/Lost. */
export function isCrmManagerTier(role?: string): boolean {
  return isCrmAdminTier(role) || upper(role) === UserRole.SALES_MANAGER;
}

/** Team lead — reassign within team (team scoping deferred; see README). */
export function isCrmTeamLead(role?: string): boolean {
  return upper(role) === UserRole.TEAM_LEAD;
}

/** Front-line staff who only see their own assigned leads. */
export function isCrmFrontline(role?: string): boolean {
  return [UserRole.TELECALLER, UserRole.FIELD_STAFF].includes(
    upper(role) as UserRole,
  );
}

/** Bulk export is restricted to Manager/Owner (A8, B7). */
export function canCrmExport(role?: string): boolean {
  return isCrmManagerTier(role);
}

/** Any recognised CRM role (used to gate the module to the team). */
export function isCrmRole(role?: string): boolean {
  return (
    isCrmManagerTier(role) ||
    isCrmTeamLead(role) ||
    isCrmFrontline(role) ||
    upper(role) === UserRole.SUPPORT
  );
}
