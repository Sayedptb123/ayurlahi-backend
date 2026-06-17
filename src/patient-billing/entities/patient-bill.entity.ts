import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { BillItem } from './bill-item.entity';

export enum BillStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  UPI = 'upi',
  ONLINE = 'online',
  CHEQUE = 'cheque',
}

@Entity('patient_bills')
export class PatientBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @Column({ type: 'uuid', nullable: true, name: 'appointment_id' })
  appointmentId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'booking_id' })
  bookingId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'admission_id' })
  admissionId: string | null;

  @Column({ type: 'varchar', length: 100, name: 'bill_number' })
  billNumber: string;

  @Column({ type: 'date', name: 'bill_date' })
  billDate: Date;

  @Column({ type: 'date', nullable: true, name: 'due_date' })
  dueDate: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'subtotal' })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'discount' })
  discount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'tax' })
  tax: number;

  // PostgreSQL GENERATED ALWAYS AS (subtotal - discount + tax) STORED — never set this manually
  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total', insert: false, update: false })
  total: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'paid_amount' })
  paidAmount: number;

  // balance is NOT stored — always compute as: total - paidAmount
  get balance(): number {
    return this.total - this.paidAmount;
  }

  @Column({ type: 'varchar', length: 20, default: BillStatus.DRAFT, name: 'status' })
  status: BillStatus;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'payment_method' })
  paymentMethod: PaymentMethod | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy: string | null;

  @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Appointment, { nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  @OneToMany(() => BillItem, (item) => item.bill, { cascade: true, eager: true })
  items: BillItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Ensure `balance` is serialized in JSON responses.
  // TypeORM/Express don't call accessor getters during JSON.stringify,
  // so we expose it explicitly on toJSON.
  toJSON() {
    return {
      ...this,
      balance: Number(this.total ?? 0) - Number(this.paidAmount ?? 0),
    };
  }
}
