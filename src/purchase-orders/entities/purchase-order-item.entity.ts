import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'item_id', nullable: true })
  itemId: string;

  @ManyToOne(() => InventoryItem, { nullable: true })
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

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
