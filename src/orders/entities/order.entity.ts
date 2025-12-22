import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
  REFUNDED = 'refunded',
}

export enum OrderSource {
  WEB = 'web',
  WHATSAPP = 'whatsapp',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clinicId: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: OrderSource,
  })
  source: OrderSource;

  @Column({ type: 'varchar', length: 100, nullable: true })
  whatsappMessageId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpayOrderId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingCharges: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  shippingAddress: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingCity: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingDistrict: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingState: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  shippingPincode: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  shippingPhone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingContactName: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  shippedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  cancelledBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}

