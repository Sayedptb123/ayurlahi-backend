import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  DeleteDateColumn, UpdateDateColumn } from 'typeorm';

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
  OUT_OF_STOCK = 'out_of_stock',
  PENDING_REVIEW = 'pending_review',
  HIDDEN = 'hidden',
  ARCHIVED = 'archived',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'manufacturer_id' })
  manufacturerId: string;

  @Column({ type: 'varchar', length: 100, name: 'sku' })
  sku: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'category' })
  category: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'batch_number' })
  batchNumber: string | null;

  @Column({ type: 'date', nullable: true, name: 'expiry_date' })
  expiryDate: Date | null;

  @Column({ type: 'date', nullable: true, name: 'manufacturing_date' })
  manufacturingDate: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'price' })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'mrp' })
  mrp: number | null;

  @Column({ type: 'varchar', length: 20, default: 'INTERNAL', name: 'fulfillment_type' })
  fulfillmentType: 'INTERNAL' | 'DROPSHIP';

  @Column({ type: 'uuid', nullable: true, name: 'vendor_id' })
  vendorId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'gst_rate' })
  gstRate: number;

  @Column({ type: 'int', default: 0, name: 'stock_quantity' })
  stockQuantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'unit' })
  unit: string | null;

  @Column({ type: 'int', default: 1, name: 'min_order_quantity' })
  minOrderQuantity: number;

  @Column({ type: 'jsonb', nullable: true, name: 'images' })
  images: string[] | null;

  @Column({ type: 'jsonb', nullable: true, name: 'specifications' })
  specifications: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, default: 'active', name: 'status' })
  status: ProductStatus;

  @Column({ type: 'boolean', default: false, name: 'requires_prescription' })
  requiresPrescription: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'license_number' })
  licenseNumber: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'form' })
  form: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'pack_size' })
  packSize: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'commission_rate' })
  commissionRate: number | null;

  @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
