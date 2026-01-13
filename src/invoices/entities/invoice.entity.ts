import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'orderId' })
  orderId: string;

  @Column({ type: 'varchar', length: 50, unique: true, name: 'invoiceNumber' })
  invoiceNumber: string;

  @Column({ type: 'varchar', length: 500, name: 's3Key' })
  s3Key: string;

  @Column({ type: 'varchar', length: 500, name: 's3Url' })
  s3Url: string;

  @Column({ type: 'date', name: 'invoiceDate' })
  invoiceDate: Date;

  @Column({ type: 'date', nullable: true, name: 'dueDate' })
  dueDate: Date | null;

  @Column({ type: 'jsonb', name: 'clinicDetails' })
  clinicDetails: Record<string, any>;

  @Column({ type: 'jsonb', name: 'items' })
  items: Record<string, any>[];

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'subtotal' })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'gstAmount' })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'shippingCharges' })
  shippingCharges: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'platformFee' })
  platformFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'totalAmount' })
  totalAmount: number;

  @Column({ type: 'boolean', default: false, name: 'isGstInvoice' })
  isGstInvoice: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'hsnCode' })
  hsnCode: string | null;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'deletedAt' })
  deletedAt: Date | null;
}
