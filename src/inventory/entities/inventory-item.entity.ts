import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column()
  name: string;

  @Column({ nullable: true })
  sku: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  // Optional link to a marketplace products(id) — hook for the low-stock →
  // "Order Now" bridge (Phase 24A). uuid FK; ON DELETE SET NULL.
  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  // Phase 24C.2 — batch/expiry for dead/expired-stock tracking
  @Column({ name: 'batch_number', type: 'varchar', length: 100, nullable: true })
  batchNumber: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column()
  unit: string;

  @Column({ name: 'current_stock', default: 0 })
  currentStock: number;

  @Column({ name: 'min_stock_level', default: 10 })
  minStockLevel: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  unitPrice: number;

  @Column({
    name: 'cost_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  costPrice: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
