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

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem;

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
