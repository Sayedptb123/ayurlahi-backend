export enum UserRole {
  // Organisation Roles (uppercase)
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN', // Org Admin
  SUPER_ADMIN = 'SUPER_ADMIN',
  SUPPORT = 'SUPPORT',

  // New Staff Roles
  NURSE = 'NURSE',
  THERAPIST = 'THERAPIST',
  PHARMACIST = 'PHARMACIST',
  RECEPTIONIST = 'RECEPTIONIST',
  LAB_TECHNICIAN = 'LAB_TECHNICIAN',

  // System/User Entity Roles (lowercase)
  CLINIC = 'clinic',
  MANUFACTURER = 'manufacturer',

  // Future
  PATIENT = 'PATIENT',
}

