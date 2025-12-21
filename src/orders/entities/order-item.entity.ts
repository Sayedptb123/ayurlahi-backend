import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from './order.entity';
import { Product } from '../../products/entities/product.entity';
import { Manufacturer } from '../../manufacturers/entities/manufacturer.entity';

@Entity('order_items')
@Index(['orderId', 'productId'])
export class OrderItem extends BaseEntity {
  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid' })
  manufacturerId: string; // Denormalized for quick access

  @Column({ type: 'varchar', length: 100 })
  productSku: string; // Denormalized for audit

  @Column({ type: 'varchar', length: 255 })
  productName: string; // Denormalized for audit

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number; // Price at time of order

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  gstRate: number; // GST rate at time of order

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number; // quantity * unitPrice

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  gstAmount: number; // GST for this line item

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number; // subtotal + gstAmount

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  commissionAmount: number; // Platform commission for this item

  @Column({ type: 'enum', enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'], default: 'pending' })
  status: string; // Individual item status for partial fulfillment

  @Column({ type: 'integer', default: 0 })
  shippedQuantity: number; // For partial fulfillment

  @Column({ type: 'integer', default: 0 })
  deliveredQuantity: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relations
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Manufacturer, (manufacturer) => manufacturer.orderItems)
  @JoinColumn({ name: 'manufacturerId' })
  manufacturer: Manufacturer;
}





