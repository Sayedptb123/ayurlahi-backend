/**
 * Utility functions for role normalization and checking
 * Handles mapping between organization-based roles (SUPER_ADMIN, OWNER, etc.)
 * and legacy frontend/service roles (admin, clinic, manufacturer, etc.)
 */

export class RoleUtils {
    /**
     * Normalize a role from organization-based format to legacy format
     * @param role - The role from JWT (e.g., 'SUPER_ADMIN', 'OWNER', 'SUPPORT')
     * @param organisationType - The organization type from JWT (e.g., 'CLINIC', 'MANUFACTURER', 'AYURLAHI_TEAM')
     * @returns Normalized role (e.g., 'admin', 'clinic', 'manufacturer', 'support')
     */
    static normalizeRole(role: string, organisationType?: string): string {
        if (!role) return '';

        const upperRole = role.toUpperCase();

        // Map organization roles to legacy roles
        if (upperRole === 'SUPER_ADMIN' || upperRole === 'ADMIN') {
            return 'admin';
        }

        if (upperRole === 'SUPPORT') {
            return 'support';
        }

        // For organization members (OWNER, MANAGER, STAFF), determine role based on organization type
        if (upperRole === 'OWNER' || upperRole === 'MANAGER' || upperRole === 'STAFF') {
            if (organisationType) {
                if (organisationType === 'CLINIC') return 'clinic';
                if (organisationType === 'MANUFACTURER') return 'manufacturer';
                if (organisationType === 'AYURLAHI_TEAM') return 'admin';
            }
        }

        // If already a legacy role (lowercase), return as-is
        return role.toLowerCase();
    }

    /**
     * Check if a user has admin privileges
     * @param role - The role to check (can be organization or legacy format)
     * @returns true if the role is admin or super_admin
     */
    static isAdmin(role: string): boolean {
        if (!role) return false;
        const upperRole = role.toUpperCase();
        return upperRole === 'ADMIN' || upperRole === 'SUPER_ADMIN' || role.toLowerCase() === 'admin';
    }

    /**
     * Check if a user has support privileges
     * @param role - The role to check (can be organization or legacy format)
     * @returns true if the role is support
     */
    static isSupport(role: string): boolean {
        if (!role) return false;
        const upperRole = role.toUpperCase();
        return upperRole === 'SUPPORT' || role.toLowerCase() === 'support';
    }

    /**
     * Check if a user has admin or support privileges
     * @param role - The role to check (can be organization or legacy format)
     * @returns true if the role is admin, super_admin, or support
     */
    static isAdminOrSupport(role: string): boolean {
        return this.isAdmin(role) || this.isSupport(role);
    }

    /**
     * Check if a role matches any of the allowed roles
     * @param role - The role to check
     * @param allowedRoles - Array of allowed roles (can be organization or legacy format)
     * @param organisationType - The organization type from JWT
     * @returns true if the role matches any allowed role
     */
    static hasRole(
        role: string,
        allowedRoles: string[],
        organisationType?: string,
    ): boolean {
        const normalized = this.normalizeRole(role, organisationType);
        const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
        return normalizedAllowed.includes(normalized);
    }
}
