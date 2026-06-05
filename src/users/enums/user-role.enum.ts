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

  // Sales CRM roles (AYURLAHI_TEAM members) — see scope/Medilink_CRM_Final_Brief.md B1
  TELECALLER = 'TELECALLER',
  FIELD_STAFF = 'FIELD_STAFF',
  TEAM_LEAD = 'TEAM_LEAD',
  SALES_MANAGER = 'SALES_MANAGER',

  // System/User Entity Roles (lowercase)
  CLINIC = 'clinic',
  MANUFACTURER = 'manufacturer',

  // Future
  PATIENT = 'PATIENT',
}

