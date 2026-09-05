// Shared "is this caller allowed to act across organisations as Ayurlahi
// Team management" check, used by any module that needs a Team-wide
// bypass (organisation-users, staff, and Phase-2 org/branch admin reads).
//
// Deliberately does NOT go through RolesGuard/@Roles() — that guard collapses
// SUPER_ADMIN and every generic org role held by an AYURLAHI_TEAM member into
// a single ADMIN bucket (see roles.guard.ts), so it can't distinguish
// SUPER_ADMIN/SUPPORT from the Sales CRM roles (TELECALLER/FIELD_STAFF/
// TEAM_LEAD/SALES_MANAGER). These checks work off the RAW JWT role instead,
// mirroring the precedent set by crm-access.util.ts for the same problem.
//
// See scope/Organisation_Users_Access_Control_Security_Fix.md and
// scope/Super_Admin_Org_Staff_Management_Phase2_Scope.md for the rule
// matrices this implements.

// Fixed seed id for the internal Team Ayurlahi organisation — also defined
// locally in orders.service.ts and product-requests.service.ts.
export const AYURLAHI_TEAM_ORG_ID = '00000000-0000-0000-0000-000000000001';

const TEAM_MANAGEMENT_ROLES = ['SUPER_ADMIN', 'SUPPORT', 'ADMIN', 'OWNER', 'MANAGER'];
const SAME_ORG_MANAGER_ROLES = ['OWNER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];

// The only Team-org roles a non-Team caller may see when reading the Team
// org's roster via the AYURLAHI_TEAM_ORG_ID carve-out (pickup-assignee picker).
const TEAM_ROSTER_VISIBLE_ROLES = ['FIELD_STAFF', 'TEAM_LEAD'];

export interface RequestingUser {
  userId: string;
  role?: string;
  organisationId?: string;
  organisationType?: string;
}

/** SUPER_ADMIN/SUPPORT (and, for forward-compat, ADMIN/OWNER/MANAGER) inside the AYURLAHI_TEAM org. Excludes Sales CRM roles. */
export function isTeamManagementTier(user: RequestingUser): boolean {
  return (
    user.organisationType === 'AYURLAHI_TEAM' &&
    TEAM_MANAGEMENT_ROLES.includes((user.role || '').toUpperCase())
  );
}

/** OWNER/MANAGER/ADMIN/SUPER_ADMIN of their own organisation. */
export function isSameOrgManager(user: RequestingUser, organisationId: string): boolean {
  return (
    !!organisationId &&
    user.organisationId === organisationId &&
    SAME_ORG_MANAGER_ROLES.includes((user.role || '').toUpperCase())
  );
}

export type RosterAccess = 'full' | 'filtered' | 'none';

/**
 * Read access to an organisation's member roster.
 * - 'full': own org (any role), or Team-management tier reading any org.
 * - 'filtered': non-Team caller reading the Team org's roster (pickup picker) —
 *   caller must only see FIELD_STAFF/TEAM_LEAD rows, not the full Team roster.
 * - 'none': deny.
 */
export function getRosterAccess(user: RequestingUser, organisationId: string): RosterAccess {
  if (user.organisationId === organisationId) return 'full';
  if (isTeamManagementTier(user)) return 'full';
  if (organisationId === AYURLAHI_TEAM_ORG_ID) return 'filtered';
  return 'none';
}

export function isTeamRosterVisibleRole(role: string): boolean {
  return TEAM_ROSTER_VISIBLE_ROLES.includes((role || '').toUpperCase());
}

/** Can view a single already-loaded organisation_users row. */
export function canViewMembershipRow(
  user: RequestingUser,
  row: { organisationId: string; role: string },
): boolean {
  const access = getRosterAccess(user, row.organisationId);
  if (access === 'full') return true;
  if (access === 'filtered') return isTeamRosterVisibleRole(row.role);
  return false;
}

/** Can create/update/delete a membership row for this organisation. */
export function canManageMembership(user: RequestingUser, organisationId: string): boolean {
  return isTeamManagementTier(user) || isSameOrgManager(user, organisationId);
}
