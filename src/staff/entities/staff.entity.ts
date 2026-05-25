import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum StaffPosition {
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
  PRODUCTION_MANAGER = 'production_manager',
  QUALITY_CONTROL = 'quality_control',
  PACKAGER = 'packager',
  WAREHOUSE_STAFF = 'warehouse_staff',
  SALES_REPRESENTATIVE = 'sales_representative',
  ACCOUNTANT = 'accountant',
  SUPERVISOR = 'supervisor',
  TECHNICIAN = 'technician',
  OTHER = 'other',
}

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName: string;

  @Column({ type: 'varchar', length: 50, name: 'position' })
  position: StaffPosition;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'position_custom' })
  positionCustom: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'email' })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone' })
  phone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'whatsapp_number' })
  whatsappNumber: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'address' })
  address: Record<string, any> | null;

  @Column({ type: 'date', nullable: true, name: 'date_of_birth' })
  dateOfBirth: Date | null;

  @Column({ type: 'date', nullable: true, name: 'date_of_joining' })
  dateOfJoining: Date | null;

  @Column({ type: 'date', nullable: true, name: 'date_of_leaving' })
  dateOfLeaving: Date | null;

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

  // Doctor-specific columns (nullable — only set for position=DOCTOR)
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'doctor_code' })
  doctorCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'license_number' })
  licenseNumber: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'consultation_fee' })
  consultationFee: number | null;

  @Column({ type: 'jsonb', nullable: true, name: 'schedule' })
  schedule: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'employee_code' })
  employeeCode: string | null;

  // User account fields
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string | null;

  @Column({ type: 'boolean', default: false, name: 'has_user_account' })
  hasUserAccount: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'user_account_status' })
  userAccountStatus: 'pending' | 'active' | 'suspended' | null;

  @Column({ type: 'timestamp', nullable: true, name: 'invitation_sent_at' })
  invitationSentAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'invitation_token' })
  invitationToken: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'invitation_expires_at' })
  invitationExpiresAt: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'organisation_type' })
  organisationType: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
