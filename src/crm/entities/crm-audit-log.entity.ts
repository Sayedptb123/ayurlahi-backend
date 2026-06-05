import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import type { CrmAuditAction, CrmAuditEntity } from '../enums/crm.enums';

/**
 * crm_audit_log — immutable, append-only audit trail (B7).
 * No updated_at / deleted_at: rows are never modified or removed. Original
 * values are preserved in `changes` when a record is edited.
 */
@Entity('crm_audit_log')
@Index(['organisationId'])
@Index(['entityType', 'entityId'])
@Index(['actorUserId'])
export class CrmAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ type: 'varchar', name: 'entity_type' })
  entityType: CrmAuditEntity;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar' })
  action: CrmAuditAction;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any> | null;

  @Column({ type: 'varchar', name: 'from_stage', nullable: true })
  fromStage: string | null;

  @Column({ type: 'varchar', name: 'to_stage', nullable: true })
  toStage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
