import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductStatus } from '../enums/product-status.enum';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'manufacturerId' })
  manufacturerId: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'batchNumber' })
  batchNumber: string | null;

  @Column({ type: 'date', nullable: true, name: 'expiryDate' })
  expiryDate: Date | null;

  @Column({ type: 'date', nullable: true, name: 'manufacturingDate' })
  manufacturingDate: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: ['INTERNAL', 'DROPSHIP'],
    default: 'INTERNAL',
    name: 'fulfillmentType'
  })
  fulfillmentType: 'INTERNAL' | 'DROPSHIP';

  @Column({ type: 'uuid', nullable: true, name: 'vendorId' })
  vendorId: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'gstRate',
  })
  gstRate: number;

  @Column({ type: 'int', default: 0, name: 'stockQuantity' })
  stockQuantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'unit' })
  unit: string | null;

  @Column({ type: 'int', default: 1, name: 'minOrderQuantity' })
  minOrderQuantity: number;

  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  specifications: Record<string, any> | null;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  @Column({ type: 'boolean', default: true, name: 'isActive' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'requiresPrescription' })
  requiresPrescription: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'licenseNumber',
  })
  licenseNumber: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'deletedAt' })
  deletedAt: Date | null;
}
