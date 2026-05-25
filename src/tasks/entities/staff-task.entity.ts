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
import { Staff } from '../../staff/entities/staff.entity';
import { User } from '../../users/entities/user.entity';

export type TaskCategory = 'general' | 'cleaning' | 'errand' | 'medical' | 'administrative';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

@Entity('staff_tasks')
export class StaffTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisationId' })
  organisationId: string;

  @Column({ type: 'varchar', length: 255, name: 'title' })
  title: string;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'general',
    name: 'category',
  })
  category: TaskCategory;

  @Column({ type: 'uuid', nullable: true, name: 'assignedToStaffId' })
  assignedToStaffId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'assignedToDoctorId' })
  assignedToDoctorId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_to_staff_id' })
  assignedToNewStaffId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'assignedToUserId' })
  assignedToUserId: string | null;

  @Column({ type: 'uuid', name: 'assignedBy' })
  assignedBy: string;

  @Column({ type: 'date', nullable: true, name: 'dueDate' })
  dueDate: string | null;

  @Column({ type: 'time', nullable: true, name: 'dueTime' })
  dueTime: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'medium',
    name: 'priority',
  })
  priority: TaskPriority;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    name: 'status',
  })
  status: TaskStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'completedAt' })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'assignedToStaffId' })
  assignedToStaff: Staff | null;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'assigned_to_staff_id' })
  assignedToNewStaff: Staff | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedToUserId' })
  assignedToUser: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedBy' })
  assignedByUser: User | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', nullable: true })
  deletedAt: Date | null;
}
