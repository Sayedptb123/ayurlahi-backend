import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Registry of valid usage_events.eventType codes -- see
 * scope/Usage_Event_Registry_Implementation_Plan.md. Every column has an
 * explicit `type:` even the ones that look like they wouldn't need one --
 * TypeScript's design:type metadata degrades to `Object` for a nullable/
 * union property, which crashes DataSource.initialize() at boot, not at
 * compile time or in any mocked-repository test (see the audit_logs
 * AuditLog entity's identical comment and the incident it documents,
 * b76949f).
 */
@Entity('usage_event_types')
export class UsageEventType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  // Decision D (Usage_Event_Registry_Implementation_Plan.md): NULL means
  // this event code hasn't had a metadata policy reviewed yet, and
  // metadata passes through unfiltered -- not an error, just unreviewed.
  // A non-null array is the allowlist; keys outside it are stripped, not
  // rejected.
  @Column({ type: 'jsonb', nullable: true, name: 'allowed_metadata_keys' })
  allowedMetadataKeys: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
