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

// ADR-005 Step 2/3 — the org-wide catalog half of the item-master +
// branch-stock split (inventory_item_masters, created by
// 2026-09-12-branch-inventory-schema.sql). Everything that's the same
// regardless of which branch holds stock (name/sku/price/hsn/gst) lives
// here; per-branch quantities live in InventoryBranchStock.
@Entity('inventory_item_masters')
export class InventoryItemMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column()
  unit: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPrice: number | null;

  @Column({ name: 'hsn_code', type: 'varchar', length: 20, nullable: true })
  hsnCode: string | null;

  @Column({ name: 'gst_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  gstRate: number | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Traceability only -- which legacy inventory_items row this master was
  // backfilled from (Step 2). NULL for any master created after cutover.
  @Column({ name: 'legacy_item_id', type: 'uuid', nullable: true })
  legacyItemId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
