import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('expenses')
@Index(['organisationId'])
@Index(['category'])
@Index(['expenseDate'])
export class Expense {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, name: 'amount' })
    amount: number;

    @Column({ type: 'varchar', length: 100, name: 'category' })
    category: string;

    @Column({ type: 'text', name: 'description' })
    description: string;

    @Column({ type: 'date', name: 'expense_date' })
    expenseDate: Date;

    @Column({ type: 'uuid', nullable: true, name: 'budget_id' })
    budgetId: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true, name: 'payment_method' })
    paymentMethod: string | null;

    @Column({ type: 'uuid', nullable: true, name: 'incurred_by' })
    incurredBy: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true, name: 'receipt_url' })
    receiptUrl: string | null;

    // pending | verified | flagged
    @Column({ type: 'varchar', length: 20, default: 'pending', name: 'status' })
    status: string;

    @Column({ type: 'text', nullable: true, name: 'flag_reason' })
    flagReason: string | null;

    @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
    approvedBy: string | null;

    @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
    approvedAt: Date | null;

    @Column({ type: 'uuid', name: 'created_by' })
    createdBy: string;

    @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
    updatedBy: string | null;

    @Column({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
