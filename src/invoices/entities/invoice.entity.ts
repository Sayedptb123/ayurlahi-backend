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

  @Column({ type: 'uuid', unique: true })
  orderId: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  invoiceNumber: string;

  @Column({ type: 'varchar', length: 500 })
  s3Key: string;

  @Column({ type: 'varchar', length: 500 })
  s3Url: string;

  @Column({ type: 'date' })
  invoiceDate: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'jsonb' })
  clinicDetails: Record<string, any>;

  @Column({ type: 'jsonb' })
  items: Record<string, any>[];

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  shippingCharges: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  platformFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'boolean', default: false })
  isGstInvoice: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  hsnCode: string | null;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}





