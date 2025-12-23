import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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
  // Manufacturer Positions
  PRODUCTION_MANAGER = 'production_manager',
  QUALITY_CONTROL = 'quality_control',
  PACKAGER = 'packager',
  WAREHOUSE_STAFF = 'warehouse_staff',
  SALES_REPRESENTATIVE = 'sales_representative',
  ACCOUNTANT = 'accountant',
  SUPERVISOR = 'supervisor',
  TECHNICIAN = 'technician',
  // Common
  OTHER = 'other',
}

export enum OrganizationType {
  CLINIC = 'clinic',
  MANUFACTURER = 'manufacturer',
}

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({
    type: 'enum',
    enum: OrganizationType,
    name: 'organization_type',
  })
  organizationType: OrganizationType;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName: string;

  @Column({
    type: 'enum',
    enum: StaffPosition,
    name: 'position',
  })
  position: StaffPosition;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'position_custom' })
  positionCustom: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'email' })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone' })
  phone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'whatsapp_number' })
  whatsappNumber: string | null;

  @Column({ type: 'text', nullable: true, name: 'address_street' })
  addressStreet: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'address_city' })
  addressCity: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'address_district' })
  addressDistrict: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'address_state' })
  addressState: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'address_zip_code' })
  addressZipCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'address_country' })
  addressCountry: string | null;

  @Column({ type: 'date', nullable: true, name: 'date_of_birth' })
  dateOfBirth: Date | null;

  @Column({ type: 'date', nullable: true, name: 'date_of_joining' })
  dateOfJoining: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'salary' })
  salary: number | null;

  @Column({ type: 'jsonb', nullable: true, name: 'qualifications' })
  qualifications: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'specialization' })
  specialization: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

