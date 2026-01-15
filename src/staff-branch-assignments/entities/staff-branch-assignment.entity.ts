import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { User } from '../../users/entities/user.entity';

export type AssignmentType = 'permanent' | 'temporary' | 'rotating';

@Entity('staff_branch_assignments')
@Index(['organisationId'])
@Index(['branchId'])
@Index(['staffId'])
@Index(['staffId', 'isActive'], { where: 'isActive = true' })
export class StaffBranchAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ type: 'uuid', name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'uuid', name: 'staff_id' })
  staffId: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @Column({
    type: 'date',
    name: 'assigned_from',
    default: () => 'CURRENT_DATE',
  })
  assignedFrom: Date;

  @Column({ type: 'date', nullable: true, name: 'assigned_to' })
  assignedTo: Date | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'permanent',
    name: 'assignment_type',
  })
  assignmentType: AssignmentType;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'branch_role' })
  branchRole: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


