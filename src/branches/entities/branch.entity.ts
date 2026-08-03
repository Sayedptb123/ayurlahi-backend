import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { User } from '../../users/entities/user.entity';

export type BranchApprovalStatus = 'pending' | 'approved' | 'rejected';

@Entity('branches')
@Index(['organisationId', 'deletedAt'])
@Index(['isActive', 'deletedAt'])
@Index(['organisationId', 'isPrimary'], {
  where: 'isPrimary = true AND deletedAt IS NULL',
})
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'whatsapp_number',
  })
  whatsappNumber: string | null;

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

  @Column({ type: 'uuid', nullable: true, name: 'manager_id' })
  managerId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'manager_id' })
  manager: User | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary: boolean;

  // ADR-004 D13 — requesting a branch under the "same hospital" D1 path goes
  // through Ayurlahi approval, same pattern as organisation registration. A
  // pending branch is not usable (Phase 4 enforcement).
  @Column({ type: 'varchar', length: 20, default: 'pending', name: 'approval_status' })
  approvalStatus: BranchApprovalStatus;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'operating_hours' })
  operatingHours: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}


