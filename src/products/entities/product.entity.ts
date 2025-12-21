import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Manufacturer } from '../../manufacturers/entities/manufacturer.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';

@Entity('products')
@Index(['sku'], { unique: true })
@Index(['manufacturerId', 'isActive'])
export class Product extends BaseEntity {
  @Column({ type: 'uuid' })
  manufacturerId: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  batchNumber: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: Date;

  @Column({ type: 'date', nullable: true })
  manufacturingDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number; // Base price per unit

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  gstRate: number; // GST percentage (e.g., 12, 18)

  @Column({ type: 'integer', default: 0 })
  stockQuantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string; // e.g., 'bottle', 'pack', 'box'

  @Column({ type: 'integer', default: 1 })
  minOrderQuantity: number;

  @Column({ type: 'jsonb', nullable: true })
  images: string[]; // S3 URLs

  @Column({ type: 'jsonb', nullable: true })
  specifications: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  requiresPrescription: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  licenseNumber: string; // Product-specific license if any

  // Relations
  @ManyToOne(() => Manufacturer, (manufacturer) => manufacturer.products)
  @JoinColumn({ name: 'manufacturerId' })
  manufacturer: Manufacturer;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];
}





