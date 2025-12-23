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

  @Column({ type: 'uuid', name: 'clinicId' })
  clinicId: string;

  @Column({ type: 'varchar', length: 50, unique: true, name: 'orderNumber' })
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

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'whatsappMessageId' })
  whatsappMessageId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'razorpayOrderId' })
  razorpayOrderId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'subtotal' })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'gstAmount' })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'shippingCharges' })
  shippingCharges: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'platformFee' })
  platformFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'totalAmount' })
  totalAmount: number;

  @Column({ type: 'text', nullable: true, name: 'shippingAddress' })
  shippingAddress: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'shippingCity' })
  shippingCity: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'shippingDistrict' })
  shippingDistrict: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'shippingState' })
  shippingState: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'shippingPincode' })
  shippingPincode: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'shippingPhone' })
  shippingPhone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'shippingContactName' })
  shippingContactName: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'confirmedAt' })
  confirmedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'shippedAt' })
  shippedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'deliveredAt' })
  deliveredAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'cancelledAt' })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'cancellationReason' })
  cancellationReason: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'cancelledBy' })
  cancelledBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'deletedAt' })
  deletedAt: Date | null;
}




