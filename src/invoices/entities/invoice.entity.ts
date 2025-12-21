import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('invoices')
@Index(['invoiceNumber'], { unique: true })
@Index(['orderId'], { unique: true })
export class Invoice extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  orderId: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  invoiceNumber: string; // e.g., INV-2024-001234

  @Column({ type: 'varchar', length: 500 })
  s3Key: string; // S3 key for the invoice PDF

  @Column({ type: 'varchar', length: 500 })
  s3Url: string; // Pre-signed URL or public URL

  @Column({ type: 'date' })
  invoiceDate: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  @Column({ type: 'jsonb' })
  clinicDetails: {
    name: string;
    gstin?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };

  @Column({ type: 'jsonb' })
  items: Array<{
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    subtotal: number;
    gstAmount: number;
    total: number;
  }>;

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
  isGstInvoice: boolean; // Whether GST is applicable

  @Column({ type: 'varchar', length: 20, nullable: true })
  hsnCode: string; // HSN code for GST

  // Relations
  @OneToOne(() => Order, (order) => order.invoice)
  @JoinColumn({ name: 'orderId' })
  order: Order;
}





