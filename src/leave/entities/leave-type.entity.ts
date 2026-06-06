import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'int', nullable: true, name: 'max_days_per_year' })
  maxDaysPerYear: number | null;

  @Column({ type: 'boolean', default: true, name: 'is_paid' })
  isPaid: boolean;

  @Column({ type: 'boolean', default: true, name: 'requires_approval' })
  requiresApproval: boolean;

  @Column({ type: 'boolean', default: false, name: 'carry_forward' })
  carryForward: boolean;

  @Column({ type: 'int', nullable: true, name: 'max_carry_forward_days' })
  maxCarryForwardDays: number | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
