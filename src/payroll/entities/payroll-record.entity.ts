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
@Index(['organizationId', 'month', 'year'])
export class PayrollRecord {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organization_id' })
    organizationId: string;

    @ManyToOne(() => Staff, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'staff_id' })
    staff: Staff;

    @Column({ type: 'uuid', name: 'staff_id' })
    staffId: string;

    @Column({ type: 'int' })
    month: number; // 1-12

    @Column({ type: 'int' })
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
    })
    status: PayrollStatus;

    @Column({ type: 'date', nullable: true, name: 'payment_date' })
    paymentDate: Date;

    @Column({ type: 'text', nullable: true, name: 'transaction_ref' })
    transactionRef: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
