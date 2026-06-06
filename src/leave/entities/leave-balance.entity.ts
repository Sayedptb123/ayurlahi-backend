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

@Entity('leave_balances')
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'uuid', name: 'staff_id' })
  staffId: string;

  @Column({ type: 'uuid', name: 'leave_type_id' })
  leaveTypeId: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, name: 'total_allotted' })
  totalAllotted: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, default: 0 })
  used: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, default: 0, name: 'carried_forward' })
  carriedForward: number;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @ManyToOne(() => LeaveType)
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
