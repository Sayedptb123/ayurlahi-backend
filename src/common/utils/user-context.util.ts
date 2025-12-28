import { UnauthorizedException } from '@nestjs/common';

/**
 * Helper utility to extract organisation context from request user
 * This bridges the gap between old services expecting user.clinicId/user.manufacturerId
 * and the new structure where organisationId comes from JWT payload
 */
export interface RequestUser {
  userId: string;
  email?: string | null;
  organisationId?: string;
  role?: string;
  organisationType?: string; // 'CLINIC' | 'MANUFACTURER' | 'AYURLAHI_TEAM'
}

/**
 * Get organisation ID from request user
 * In the new structure, this comes from JWT payload (organisationId)
 */
export function getOrganisationId(user: RequestUser): string {
  if (!user.organisationId) {
    throw new UnauthorizedException(
      'User does not have an active organisation context',
    );
  }
  return user.organisationId;
}

/**
 * Get clinic ID from request user (for backward compatibility)
 * In the new structure, this is the organisationId if organisationType is 'CLINIC'
 */
export function getClinicId(user: RequestUser): string {
  const orgId = getOrganisationId(user);
  if (user.organisationType !== 'CLINIC') {
    throw new UnauthorizedException('User is not associated with a clinic');
  }
  return orgId;
}

/**
 * Get manufacturer ID from request user (for backward compatibility)
 * In the new structure, this is the organisationId if organisationType is 'MANUFACTURER'
 */
export function getManufacturerId(user: RequestUser): string {
  const orgId = getOrganisationId(user);
  if (user.organisationType !== 'MANUFACTURER') {
    throw new UnauthorizedException(
      'User is not associated with a manufacturer',
    );
  }
  return orgId;
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: RequestUser, role: string): boolean {
  return user.role === role;
}

/**
 * Check if user is associated with a clinic
 */
export function isClinicUser(user: RequestUser): boolean {
  return user.organisationType === 'CLINIC';
}

/**
 * Check if user is associated with a manufacturer
 */
export function isManufacturerUser(user: RequestUser): boolean {
  return user.organisationType === 'MANUFACTURER';
}

