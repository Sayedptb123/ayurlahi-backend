import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RecurringBill } from './recurring-bill.entity';
import { Expense } from '../../expenses/entities/expense.entity';

@Entity('bill_payments')
@Index(['recurringBillId'])
@Index(['expenseId'])
export class BillPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'recurring_bill_id' })
  recurringBillId: string;

  @Column({ type: 'date', nullable: true, name: 'bill_period_start' })
  billPeriodStart: Date | null;

  @Column({ type: 'date', nullable: true, name: 'bill_period_end' })
  billPeriodEnd: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'bill_amount' })
  billAmount: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'bill_number' })
  billNumber: string | null;

  @Column({ type: 'date', nullable: true, name: 'bill_date' })
  billDate: Date | null;

  @Column({ type: 'date', nullable: true, name: 'due_date' })
  dueDate: Date | null;

  @Column({ type: 'text', nullable: true, name: 'bill_url' })
  billUrl: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'paid_amount' })
  paidAmount: number;

  @Column({ type: 'date', name: 'paid_date' })
  paidDate: Date;

  @Column({ type: 'boolean', default: false, name: 'is_late' })
  isLate: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'late_fee' })
  lateFee: number;

  @Column({ type: 'uuid', nullable: true, name: 'expense_id' })
  expenseId: string | null;

  @ManyToOne(() => RecurringBill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recurring_bill_id' })
  recurringBill: RecurringBill;

  @ManyToOne(() => Expense, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
