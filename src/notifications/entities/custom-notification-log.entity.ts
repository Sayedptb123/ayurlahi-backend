import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type BroadcastTargetType = 'all' | 'all_clinics' | 'all_manufacturers' | 'single_org';

@Entity('custom_notification_logs')
export class CustomNotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 30, name: 'target_type' })
  targetType: BroadcastTargetType;

  @Column({ type: 'uuid', nullable: true, name: 'organisation_id' })
  organisationId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  roles: string[] | null;

  @Column({ type: 'jsonb', nullable: true, name: 'specific_user_ids' })
  specificUserIds: string[] | null;

  @Column({ type: 'int', default: 0, name: 'resolved_user_count' })
  resolvedUserCount: number;

  @Column({ type: 'uuid', name: 'sent_by_user_id' })
  sentByUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
