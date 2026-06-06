import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Branch } from '../../branches/entities/branch.entity';

export enum RecurringBillFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

@Entity('recurring_bills')
@Index(['organisationId'])
@Index(['nextDueDate'])
export class RecurringBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
  branchId: string | null;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 255, name: 'bill_name' })
  billName: string;

  @Column({ type: 'varchar', length: 50, name: 'bill_type' })
  billType: string;

  @Column({ type: 'varchar', length: 255, name: 'vendor_name' })
  vendorName: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'vendor_account_number' })
  vendorAccountNumber: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'vendor_contact' })
  vendorContact: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'estimated_amount' })
  estimatedAmount: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: RecurringBillFrequency.MONTHLY,
  })
  frequency: RecurringBillFrequency;

  @Column({ type: 'int', nullable: true, name: 'day_of_month' })
  dayOfMonth: number | null;

  @Column({ type: 'int', nullable: true, name: 'day_of_week' })
  dayOfWeek: number | null;

  @Column({ type: 'jsonb', nullable: true, name: 'custom_pattern' })
  customPattern: any | null;

  @Column({ type: 'boolean', default: false, name: 'auto_create_expense' })
  autoCreateExpense: boolean;

  @Column({ type: 'boolean', default: false, name: 'auto_approve' })
  autoApprove: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'approval_threshold' })
  approvalThreshold: number | null;

  @Column({ type: 'boolean', default: false, name: 'auto_pay' })
  autoPay: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'payment_method' })
  paymentMethod: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'date', name: 'next_due_date' })
  nextDueDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
