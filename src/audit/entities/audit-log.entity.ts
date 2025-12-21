import {
  Entity,
  Column,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AuditAction } from '../../common/enums/audit-action.enum';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  userId: string; // User who performed the action

  @Column({ type: 'varchar', length: 100 })
  entityType: string; // 'order', 'payment', 'user', etc.

  @Column({ type: 'uuid', nullable: true })
  entityId: string; // ID of the entity

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValues: Record<string, any>; // Previous state

  @Column({ type: 'jsonb', nullable: true })
  newValues: Record<string, any>; // New state

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Additional context
}





