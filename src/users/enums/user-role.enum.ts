export enum UserRole {
  // Organisation Roles (uppercase)
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN', // Org Admin
  SUPER_ADMIN = 'SUPER_ADMIN',
  SUPPORT = 'SUPPORT',

  // System/User Entity Roles (lowercase)
  CLINIC = 'clinic',
  MANUFACTURER = 'manufacturer',
}
