import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from '../../orders/entities/order.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { RefundStatus } from '../../common/enums/refund-status.enum';
import { RefundReason } from '../../common/enums/refund-reason.enum';

@Entity('refunds')
@Index(['orderId'])
@Index(['paymentId'])
@Index(['razorpayRefundId'], { unique: true, where: '"razorpayRefundId" IS NOT NULL' })
export class Refund extends BaseEntity {
  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  paymentId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpayRefundId: string;

  @Column({ type: 'enum', enum: RefundStatus, default: RefundStatus.PENDING })
  status: RefundStatus;

  @Column({ type: 'enum', enum: RefundReason })
  reason: RefundReason;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number; // Amount in paise

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  failedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  initiatedBy: string; // User ID who initiated refund

  @Column({ type: 'jsonb', nullable: true })
  razorpayResponse: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  splitRefundDetails: {
    platform: number; // Platform commission refund in paise
    manufacturers: Array<{
      manufacturerId: string;
      amount: number; // Amount in paise
    }>;
  };

  // Relations
  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;
}





