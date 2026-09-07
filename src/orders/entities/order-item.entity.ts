import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

export enum OrderItemStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  PACKED = 'packed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid' })
  manufacturerId: string;

  @Column({ type: 'varchar', length: 100 })
  productSku: string;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'int' })
  quantity: number;

  // What was actually committed against products.stockQuantity at
  // reservation time -- capped to whatever was available, so this can be
  // less than `quantity` (down to 0) once partial fulfillment is possible.
  // Distinct from packedQuantity below: reservation is an inventory
  // commitment made at accept-time; packing is a later, separate,
  // authoritative fact that can itself land lower than what was reserved
  // (e.g. a reserved unit fails a quality check during packing). Existing
  // rows (created before this column existed, when reservation was always
  // all-or-nothing) are backfilled to `quantity` -- see the migration.
  @Column({ type: 'int', name: 'reserved_quantity' })
  reservedQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  // External orders only: the real catalog price at the time, preserved for
  // audit when unitPrice is a manufacturer-entered agreed price that differs
  // from it. NULL for normal marketplace orders (unitPrice already equals
  // catalog price there, so this would just duplicate it).
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'catalog_price_at_order' })
  catalogPriceAtOrder: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  mrp: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  hsnCode: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  gstRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  commissionAmount: number;

  @Column({
    type: 'enum',
    enum: OrderItemStatus,
    default: OrderItemStatus.PENDING,
  })
  status: OrderItemStatus;

  @Column({ type: 'int', default: 0 })
  shippedQuantity: number;

  @Column({ type: 'int', default: 0 })
  deliveredQuantity: number;

  // Actual packed/supplied quantity, recorded by the manufacturer during
  // packing -- authoritative for billing and clinic inventory credit once
  // partial fulfillment is supported. `quantity` above stays the immutable
  // requested amount. Deliberately a new column rather than repurposing
  // shippedQuantity/deliveredQuantity (both confirmed dormant, but packing,
  // shipping, and delivery are separately-observable events) -- see
  // scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §11.
  @Column({ type: 'int', name: 'packed_quantity', default: 0 })
  packedQuantity: number;

  // Per-item discount entered by the manufacturer's packing team -- a flat
  // amount, not a percentage, summed into order.discountAmount /
  // invoice.discountAmount for the bill breakdown's total-discount line.
  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'discount_amount', default: 0 })
  discountAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Ayurlahi-managed fulfillment: who's collecting this item from the
  // manufacturer, and when they actually did. Assignment != pickup.
  @Column({ type: 'uuid', name: 'assigned_user_id', nullable: true })
  assignedUserId: string | null;

  @Column({ type: 'timestamptz', name: 'picked_up_at', nullable: true })
  pickedUpAt: Date | null;

  // orphanedRowAction: 'disable' -- this is the side TypeORM actually checks
  // (relation.inverseRelation.orphanedRowAction in
  // OneToManySubjectBuilder.buildForSubjectRelation, not the option on
  // Order.items itself) when an item is removed from order.items before
  // ordersRepository.save(order). Without this, the default ('nullify')
  // tries to null out order_id on the removed row -- which fails outright
  // since order_id is NOT NULL, and would crash ANY future save() of an
  // order that has ever had an item amendment-removed (§6/Step 5 of
  // scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md), not just the
  // removal call itself. No code path before amendments ever shrank
  // order.items before saving, so this was never exercised until
  // removeOrderItem() hit it directly (QueryFailedError: null value in
  // column "order_id" ... violates not-null constraint) -- found and fixed
  // during Step 5 live testing, confirmed by reading TypeORM's own source.
  // 'disable' leaves a removed item's row untouched, which is correct here:
  // removeOrderItem() already persists its soft-delete explicitly via a
  // separate orderItemsRepository.save() before removing it from the array.
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE', orphanedRowAction: 'disable' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
