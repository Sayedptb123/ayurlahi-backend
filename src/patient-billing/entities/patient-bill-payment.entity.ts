import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PatientBill, PaymentMethod } from './patient-bill.entity';

// One row per payment received against a patient bill (the ledger). The bill's
// paid_amount is a cache; SUM(amount) over the non-deleted rows here is the
// source of truth. See ADR-003 D2/D3.
@Entity('patient_bill_payments')
export class PatientBillPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'uuid', name: 'bill_id' })
  billId: string;

  @ManyToOne(() => PatientBill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bill_id' })
  bill: PatientBill;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'amount' })
  amount: number;

  // The calendar day the money was received (may be backdated by the receptionist).
  @Column({ type: 'date', name: 'paid_at' })
  paidAt: string;

  @Column({ type: 'varchar', length: 20, name: 'payment_method' })
  paymentMethod: PaymentMethod;

  // Cheque number / UPI transaction id / receipt number — free text.
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'reference_no' })
  referenceNo: string | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete — financial records are never hard-deleted (voiding a mistaken entry).
  @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;
}
