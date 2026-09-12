import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryItemMaster } from '../../inventory/entities/inventory-item-master.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  // Legacy -- FK to the pre-cutover inventory_items table. Left untouched
  // (ADR-005 Step 2/3 deferral); no new PO item populates this going
  // forward, itemMasterId below does instead.
  @Column({ name: 'item_id', nullable: true })
  itemId: string;

  @ManyToOne(() => InventoryItem, { nullable: true })
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  // ADR-005 Step 3 -- resolves against the new item-master catalog.
  // Additive column (2026-09-12-purchase-order-items-master-ref.sql):
  // itemId's FK targets the legacy table, so a master's id can't be
  // stored there without violating that constraint.
  @Column({ name: 'item_master_id', type: 'uuid', nullable: true })
  itemMasterId: string | null;

  @ManyToOne(() => InventoryItemMaster, { nullable: true })
  @JoinColumn({ name: 'item_master_id' })
  itemMaster: InventoryItemMaster | null;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column()
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2 })
  totalPrice: number;

  @Column({ name: 'received_quantity', default: 0 })
  receivedQuantity: number;
}
