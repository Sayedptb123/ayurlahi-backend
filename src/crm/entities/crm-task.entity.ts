import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { CrmLead } from './crm-lead.entity';
import type { CrmTaskStatus } from '../enums/crm.enums';

/**
 * crm_tasks — follow-ups & reminders (B3, B6).
 * Overdue tasks escalate to the manager after X days (escalatedAt set by cron).
 */
@Entity('crm_tasks')
@Index(['leadId'])
@Index(['organisationId'])
@Index(['assigneeUserId'])
@Index(['dueAt'])
@Index(['status'])
export class CrmTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'lead_id' })
  leadId: string;

  @ManyToOne(() => CrmLead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: CrmLead;

  @Column({ name: 'assignee_user_id', type: 'uuid' })
  assigneeUserId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', name: 'task_type', nullable: true })
  taskType: string | null;

  @Column({ name: 'due_at', type: 'timestamp' })
  dueAt: Date;

  @Column({ name: 'reminder_at', type: 'timestamp', nullable: true })
  reminderAt: Date | null;

  @Column({ type: 'varchar', default: 'pending' })
  status: CrmTaskStatus;

  @Column({ name: 'is_recurring', default: false })
  isRecurring: boolean;

  @Column({ type: 'varchar', nullable: true })
  recurrence: string | null;

  @Column({ name: 'escalated_at', type: 'timestamp', nullable: true })
  escalatedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
