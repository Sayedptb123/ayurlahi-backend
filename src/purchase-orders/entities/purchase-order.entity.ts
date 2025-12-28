import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { User } from '../../users/entities/user.entity';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'po_number' })
  poNumber: string;

  @Column({ name: 'order_date', type: 'date', default: () => 'CURRENT_DATE' })
  orderDate: string;

  @Column({ name: 'expected_delivery_date', type: 'date', nullable: true })
  expectedDeliveryDate: string;

  @Column({ default: 'draft' })
  status: string; // draft, sent, received, cancelled

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(
    () => PurchaseOrderItem,
    (item: PurchaseOrderItem) => item.purchaseOrder,
    { cascade: true },
  )
  items: PurchaseOrderItem[];

  @Column({ name: 'created_by', nullable: true })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
