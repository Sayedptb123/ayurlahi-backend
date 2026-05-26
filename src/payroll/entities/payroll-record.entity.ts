import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Staff } from '../../staff/entities/staff.entity';

export enum PayrollStatus {
    DRAFT = 'draft',
    PENDING = 'pending',
    PAID = 'paid',
    FAILED = 'failed',
}

@Entity('payroll_records')
@Index(['organisationId', 'month', 'year'])
export class PayrollRecord {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @Column({ type: 'uuid', name: 'staff_id' })
    staffId: string;

    @ManyToOne(() => Staff, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'staff_id' })
    staff: Staff;

    @Column({ type: 'int', name: 'month' })
    month: number;

    @Column({ type: 'int', name: 'year' })
    year: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'basic_pay' })
    basicPay: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_allowances' })
    totalAllowances: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_deductions' })
    totalDeductions: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'net_pay' })
    netPay: number;

    @Column({
        type: 'enum',
        enum: PayrollStatus,
        default: PayrollStatus.DRAFT,
        name: 'status',
    })
    status: PayrollStatus;

    @Column({ type: 'date', nullable: true, name: 'payment_date' })
    paymentDate: Date | null;

    @Column({ type: 'text', nullable: true, name: 'transaction_ref' })
    transactionRef: string | null;

    @Column({ type: 'uuid', nullable: true, name: 'created_by' })
    createdBy: string | null;

    @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
    updatedBy: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
