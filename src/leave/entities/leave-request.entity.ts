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
import { Staff } from '../../staff/entities/staff.entity';
import { LeaveType } from './leave-type.entity';
import { User } from '../../users/entities/user.entity';

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'uuid', name: 'staff_id' })
  staffId: string;

  @Column({ type: 'uuid', name: 'leave_type_id' })
  leaveTypeId: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate: Date;

  @Column({ type: 'decimal', precision: 4, scale: 1, name: 'total_days' })
  totalDays: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 20, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ type: 'uuid', nullable: true, name: 'requested_by' })
  requestedBy: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'covered_by_staff_id' })
  coveredByStaffId: string | null;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @ManyToOne(() => LeaveType)
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'covered_by_staff_id' })
  coveredByStaff: Staff | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requested_by' })
  requestedByUser: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
