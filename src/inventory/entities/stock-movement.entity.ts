import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { InventoryItem } from './inventory-item.entity';

/**
 * stock_movements — Phase 24C.1. An append-only ledger of every change to an
 * inventory item's stock, so consumption / turnover / days-of-cover can be
 * computed (the groundwork toward forecasting). `quantity` is the SIGNED delta
 * applied (+in, -out); `balanceAfter` snapshots current_stock after the change.
 * Numeric columns return strings from PostgreSQL — parseFloat before arithmetic.
 */
export type StockMovementType =
  | 'initial'
  | 'manual_adjustment'
  | 'purchase_receipt' // off-platform PO received
  | 'order_delivery' // on-platform marketplace order delivered
  | 'consumption';

@Entity('stock_movements')
@Index(['inventoryItemId'])
@Index(['organisationId'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  // Nullable as of ADR-005 Step 3 (2026-09-12-stock-movements-nullable-
  // item.sql) -- a legacy inventory_items row, when one exists (every
  // pre-cutover item). NULL for a movement against an item created after
  // Step 3's cutover, which has no legacy row to point at -- branchId
  // below is the reference for those.
  @Column({ name: 'inventory_item_id', type: 'uuid', nullable: true })
  inventoryItemId: string | null;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem | null;

  // ADR-005 Step 2/3 -- which branch this movement affected. NULL for a
  // branch-less org (Invariant 2), populated for every movement recorded
  // through the new item-master/branch-stock code path regardless of
  // whether inventoryItemId is also set.
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  // ADR-005 Step 3 -- which inventory_branch_stock row this movement is
  // for. NULL for a legacy movement (inventoryItemId set instead);
  // populated for every movement recorded through the new
  // item-master/branch-stock code path. The two are mutually exclusive in
  // practice, not enforced at the DB level -- InventoryService always sets
  // exactly one.
  @Column({ name: 'inventory_branch_stock_id', type: 'uuid', nullable: true })
  inventoryBranchStockId: string | null;

  @Column({ name: 'movement_type', type: 'varchar', length: 30 })
  movementType: StockMovementType;

  // Signed delta applied to current_stock (+in / -out).
  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'balance_after', type: 'int', nullable: true })
  balanceAfter: number | null;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  unitCost: number | null;

  // Optional provenance, e.g. 'purchase_order' / 'order' / 'manual'.
  @Column({ name: 'reference_type', type: 'varchar', length: 30, nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
