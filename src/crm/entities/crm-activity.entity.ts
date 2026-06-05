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
import type { CrmActivityType } from '../enums/crm.enums';

/**
 * crm_activities — interaction timeline, one row per touch (B3, B4).
 * occurred_at is the REAL moment of the touch (offline activities keep their
 * original timestamp; synced_at records when they reached the server).
 */
@Entity('crm_activities')
@Index(['leadId'])
@Index(['organisationId'])
@Index(['staffUserId'])
export class CrmActivity {
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

  @Column({ type: 'varchar' })
  type: CrmActivityType;

  @Column({ type: 'varchar', nullable: true })
  disposition: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt: Date;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ name: 'staff_user_id', type: 'uuid' })
  staffUserId: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[] | null;

  @Column({ name: 'next_action', type: 'text', nullable: true })
  nextAction: string | null;

  @Column({ name: 'next_action_due_at', type: 'timestamp', nullable: true })
  nextActionDueAt: Date | null;

  @Column({ name: 'call_log_verified', default: false })
  callLogVerified: boolean;

  @Column({ type: 'varchar', name: 'whatsapp_template', nullable: true })
  whatsappTemplate: string | null;

  @Column({ name: 'created_offline', default: false })
  createdOffline: boolean;

  @Column({ name: 'synced_at', type: 'timestamp', nullable: true })
  syncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
