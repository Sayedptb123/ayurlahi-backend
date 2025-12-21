import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from '../../orders/entities/order.entity';
import { PaymentStatus } from '../../common/enums/payment-status.enum';

@Entity('payments')
@Index(['razorpayPaymentId'], { unique: true, where: '"razorpayPaymentId" IS NOT NULL' })
@Index(['orderId'], { unique: true })
export class Payment extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  orderId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpayPaymentId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpayOrderId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpaySignature: string; // For webhook verification

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number; // Amount in paise (Razorpay uses paise)

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  method: string | null; // 'card', 'netbanking', 'upi', 'wallet', etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  bank: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wallet: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vpa: string | null; // UPI VPA

  @Column({ type: 'varchar', length: 50, nullable: true })
  cardId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  capturedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  failedAt: Date;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'jsonb', nullable: true })
  razorpayResponse: Record<string, any>; // Full Razorpay response

  @Column({ type: 'jsonb', nullable: true })
  splitDetails: {
    platform: number; // Platform commission in paise
    manufacturers: Array<{
      manufacturerId: string;
      amount: number; // Amount in paise
      accountId?: string; // Razorpay account ID for split
    }>;
  };

  // Relations
  @OneToOne(() => Order, (order) => order.payment)
  @JoinColumn({ name: 'orderId' })
  order: Order;
}

