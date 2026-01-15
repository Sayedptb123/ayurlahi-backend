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
import { Branch } from '../../branches/entities/branch.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { DutyType } from '../../duty-types/entities/duty-type.entity';
import { User } from '../../users/entities/user.entity';

export type DutyStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'absent'
  | 'cancelled';

@Entity('duty_assignments')
@Index(['organisationId', 'deletedAt'])
@Index(['branchId', 'deletedAt'])
@Index(['staffId', 'deletedAt'])
@Index(['dutyTypeId', 'deletedAt'])
@Index(['dutyDate', 'deletedAt'])
@Index(['staffId', 'dutyDate', 'deletedAt'])
export class DutyAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
  branchId: string | null;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @Column({ type: 'uuid', name: 'staff_id' })
  staffId: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @Column({ type: 'uuid', name: 'duty_type_id' })
  dutyTypeId: string;

  @ManyToOne(() => DutyType)
  @JoinColumn({ name: 'duty_type_id' })
  dutyType: DutyType;

  @Column({ type: 'date', name: 'duty_date' })
  dutyDate: Date;

  @Column({ type: 'time', nullable: true, name: 'start_time' })
  startTime: string | null;

  @Column({ type: 'time', nullable: true, name: 'end_time' })
  endTime: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'checked_in_at' })
  checkedInAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'checked_out_at' })
  checkedOutAt: Date | null;

  @Column({ type: 'jsonb', nullable: true, name: 'check_in_location' })
  checkInLocation: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'check_out_location' })
  checkOutLocation: Record<string, any> | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'scheduled',
  })
  status: DutyStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'replaced_by_staff_id' })
  replacedByStaffId: string | null;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'replaced_by_staff_id' })
  replacedByStaff: Staff | null;

  @Column({ type: 'text', nullable: true, name: 'replacement_reason' })
  replacementReason: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_by' })
  assignedBy: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_by' })
  assigner: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}


