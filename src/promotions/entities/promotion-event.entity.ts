import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Promotion } from './promotion.entity';

export enum PromotionEventType {
  IMPRESSION = 'IMPRESSION',
  CLICK = 'CLICK',
  DISMISS = 'DISMISS',
}

@Entity('promotion_events')
export class PromotionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Promotion, (promo) => promo.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion: Promotion;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Organisation, { nullable: true })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType: PromotionEventType;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
