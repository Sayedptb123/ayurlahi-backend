import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { OrderSource } from '../../common/enums/order-source.enum';

@Entity('orders')
@Index(['clinicId', 'createdAt'])
@Index(['orderNumber'], { unique: true })
@Index(['razorpayOrderId'], { unique: true, where: '"razorpayOrderId" IS NOT NULL' })
export class Order extends BaseEntity {
  @Column({ type: 'uuid' })
  clinicId: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  orderNumber: string; // e.g., AY-2024-001234

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'enum', enum: OrderSource })
  source: OrderSource;

  @Column({ type: 'varchar', length: 100, nullable: true })
  whatsappMessageId: string; // For WhatsApp orders

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpayOrderId: string; // Razorpay order ID

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number; // Sum of all items before tax

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  gstAmount: number; // Total GST

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingCharges: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformFee: number; // Platform service fee

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number; // Final amount to be paid

  @Column({ type: 'text', nullable: true })
  shippingAddress: string; // Full address for delivery

  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingCity: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingDistrict: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingState: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  shippingPincode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  shippingPhone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingContactName: string;

  @Column({ type: 'text', nullable: true })
  notes: string; // Order notes from clinic

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  shippedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ type: 'uuid', nullable: true })
  cancelledBy: string; // User ID who cancelled

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Additional order metadata

  // Relations
  @ManyToOne(() => Clinic, (clinic) => clinic.orders)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, { cascade: true })
  items: OrderItem[];

  @OneToOne(() => Payment, (payment) => payment.order, { nullable: true })
  payment: Payment;

  @OneToOne(() => Invoice, (invoice) => invoice.order, { nullable: true })
  invoice: Invoice;
}




