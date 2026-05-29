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
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

@Entity('organisations')
@Index(['type', 'deletedAt'])
@Index(['approvalStatus', 'deletedAt'])
export class Organisation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 50, name: 'type' })
  type: OrganisationType;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    name: 'approval_status',
  })
  approvalStatus: ApprovalStatus;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'documents' })
  documents: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToMany(() => OrganisationUser, (orgUser) => orgUser.organisation)
  users: OrganisationUser[];
}
