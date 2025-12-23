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
import { Clinic } from '../../clinics/entities/clinic.entity';
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
  ONLINE = 'online',
  CHEQUE = 'cheque',
}

@Entity('patient_bills')
export class PatientBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'clinicId' })
  clinicId: string;

  @Column({ type: 'uuid', name: 'patientId' })
  patientId: string;

  @Column({ type: 'uuid', nullable: true, name: 'appointmentId' })
  appointmentId: string | null;

  @Column({ type: 'varchar', length: 100, unique: true, name: 'billNumber' })
  billNumber: string;

  @Column({ type: 'date', name: 'billDate' })
  billDate: Date;

  @Column({ type: 'date', nullable: true, name: 'dueDate' })
  dueDate: Date | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'subtotal',
  })
  subtotal: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'discount',
  })
  discount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'tax',
  })
  tax: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'total',
  })
  total: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'paidAmount',
  })
  paidAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'balance',
  })
  balance: number;

  @Column({
    type: 'enum',
    enum: BillStatus,
    default: BillStatus.DRAFT,
    name: 'status',
  })
  status: BillStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
    name: 'paymentMethod',
  })
  paymentMethod: PaymentMethod | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @ManyToOne(() => Appointment, { nullable: true })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment | null;

  @OneToMany(() => BillItem, (item) => item.bill, {
    cascade: true,
    eager: true,
  })
  items: BillItem[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}

