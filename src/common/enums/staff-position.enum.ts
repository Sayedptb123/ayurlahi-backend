export enum StaffPosition {
  // Clinic Positions
  DOCTOR = 'doctor',
  THERAPIST = 'therapist',
  AYURVEDIC_PRACTITIONER = 'ayurvedic_practitioner',
  MASSAGE_THERAPIST = 'massage_therapist',
  YOGA_INSTRUCTOR = 'yoga_instructor',
  DIETITIAN = 'dietitian',
  NUTRITIONIST = 'nutritionist',
  PHARMACIST = 'pharmacist',
  NURSE = 'nurse',
  COOK = 'cook',
  CHEF = 'chef',
  HELPER = 'helper',
  ASSISTANT = 'assistant',
  RECEPTIONIST = 'receptionist',
  MANAGER = 'manager',
  ADMINISTRATOR = 'administrator',
  OTHER = 'other',

  // Manufacturer Positions
  PRODUCTION_MANAGER = 'production_manager',
  QUALITY_CONTROL = 'quality_control',
  PACKAGER = 'packager',
  WAREHOUSE_STAFF = 'warehouse_staff',
  SALES_REPRESENTATIVE = 'sales_representative',
  ACCOUNTANT = 'accountant',
  SUPERVISOR = 'supervisor',
  TECHNICIAN = 'technician',
}

export const CLINIC_POSITIONS = [
  StaffPosition.DOCTOR,
  StaffPosition.THERAPIST,
  StaffPosition.AYURVEDIC_PRACTITIONER,
  StaffPosition.MASSAGE_THERAPIST,
  StaffPosition.YOGA_INSTRUCTOR,
  StaffPosition.DIETITIAN,
  StaffPosition.NUTRITIONIST,
  StaffPosition.PHARMACIST,
  StaffPosition.NURSE,
  StaffPosition.COOK,
  StaffPosition.CHEF,
  StaffPosition.HELPER,
  StaffPosition.ASSISTANT,
  StaffPosition.RECEPTIONIST,
  StaffPosition.MANAGER,
  StaffPosition.ADMINISTRATOR,
  StaffPosition.OTHER,
];

export const MANUFACTURER_POSITIONS = [
  StaffPosition.PRODUCTION_MANAGER,
  StaffPosition.QUALITY_CONTROL,
  StaffPosition.PACKAGER,
  StaffPosition.WAREHOUSE_STAFF,
  StaffPosition.SALES_REPRESENTATIVE,
  StaffPosition.ACCOUNTANT,
  StaffPosition.SUPERVISOR,
  StaffPosition.TECHNICIAN,
  StaffPosition.MANAGER,
  StaffPosition.ADMINISTRATOR,
  StaffPosition.OTHER,
];

export function isValidPositionForOrganization(
  position: StaffPosition,
  organizationType: 'clinic' | 'manufacturer',
): boolean {
  if (organizationType === 'clinic') {
    return CLINIC_POSITIONS.includes(position);
  } else {
    return MANUFACTURER_POSITIONS.includes(position);
  }
}


