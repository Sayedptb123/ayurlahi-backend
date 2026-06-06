import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organisation } from '../../organisations/entities/organisation.entity';

@Entity('usage_events')
export class UsageEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organisation, { nullable: true })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'event_type', length: 100 })
  eventType: string;

  @Column({ name: 'screen_name', length: 100, nullable: true })
  screenName: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ length: 50, nullable: true })
  platform: string;

  @Column({ name: 'app_version', length: 50, nullable: true })
  appVersion: string;

  @Column({ name: 'session_id', length: 100, nullable: true })
  sessionId: string;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
