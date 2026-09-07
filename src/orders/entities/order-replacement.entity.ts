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
import { OrderItem } from './order-item.entity';

export enum ReplacementReason {
  MISSING = 'missing',
  WRONG = 'wrong',
  DAMAGED = 'damaged',
}

export enum ReplacementStatus {
  PENDING = 'pending',
  SHIPPED = 'shipped',
  RESOLVED = 'resolved',
}

// Structured post-delivery replacement record -- missing/wrong/damaged item,
// always charge=0, shipped against the original order (never a new order or
// invoice). Deliberately not a duplicate of `disputes` (free-text case
// tracking, no quantity/product reference at all): disputeId optionally
// links back to the human-facing case a clinic raised there, keeping the two
// different shapes of data separate. See
// scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §9.
@Entity('order_replacements')
export class OrderReplacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @Column({ type: 'uuid', name: 'order_item_id' })
  orderItemId: string;

  // No @ManyToOne relation to Dispute here -- disputes/entities/dispute.entity.ts
  // already imports Order from this same orders/entities directory, so
  // importing Dispute back would create a circular module dependency. Plain
  // FK-by-convention column instead, same style already used throughout this
  // codebase for organisationId/cancelledBy/etc.
  @Column({ type: 'uuid', name: 'dispute_id', nullable: true })
  disputeId: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ReplacementReason,
    name: 'reason',
  })
  reason: ReplacementReason;

  // Always 0 today -- a manufacturer-side fulfillment correction, not a
  // sale. Stored as a real column rather than assumed, for auditability.
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  charge: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ReplacementStatus,
    default: ReplacementStatus.PENDING,
    name: 'status',
  })
  status: ReplacementStatus;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
