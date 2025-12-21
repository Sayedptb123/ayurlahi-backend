import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

@Entity('subscriptions')
@Index(['clinicId', 'status'])
export class Subscription extends BaseEntity {
  @Column({ type: 'uuid' })
  clinicId: string;

  @Column({ type: 'varchar', length: 50 })
  planName: string; // e.g., 'basic', 'premium', 'enterprise'

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.INACTIVE })
  status: SubscriptionStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthlyFee: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'date', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpaySubscriptionId: string; // For recurring payments

  @Column({ type: 'jsonb', nullable: true })
  features: {
    maxOrdersPerMonth?: number;
    prioritySupport?: boolean;
    customCommission?: boolean;
    analyticsAccess?: boolean;
  };

  // Relations
  @ManyToOne(() => Clinic, (clinic) => clinic.subscriptions)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;
}





