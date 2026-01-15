import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { OrganisationUser } from '../../organisation-users/entities/organisation-user.entity';

export type OrganisationType = 'AYURLAHI_TEAM' | 'CLINIC' | 'MANUFACTURER';
export type OrganisationStatus = 'active' | 'suspended' | 'inactive';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

@Entity('organisations')
@Index(['type', 'deletedAt'])
@Index(['status', 'deletedAt'])
@Index(['approvalStatus', 'deletedAt'])
export class Organisation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: OrganisationType;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status: OrganisationStatus;

  // Clinic-specific fields (nullable)
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'clinic_name' })
  clinicName: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
    name: 'license_number',
  })
  licenseNumber: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gstin: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'India' })
  country: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'whatsapp_number',
  })
  whatsappNumber: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'social_media' })
  socialMedia: Record<string, any> | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    name: 'approval_status',
  })
  approvalStatus: ApprovalStatus;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  documents: Record<string, any> | null;

  @Column({ type: 'boolean', default: false, name: 'is_verified' })
  isVerified: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy: string | null;

  // Manufacturer-specific fields (nullable)
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'company_name',
  })
  companyName: string | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    name: 'commission_rate',
  })
  commissionRate: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToMany(() => OrganisationUser, (orgUser) => orgUser.organisation)
  users: OrganisationUser[];
}


