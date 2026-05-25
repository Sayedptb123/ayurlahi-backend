import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum ExpenseCategory {
    OPERATIONS = 'operations',
    SALARY = 'salary',
    INVENTORY = 'inventory',
    MARKETING = 'marketing',
    MAINTENANCE = 'maintenance',
    UTILITIES = 'utilities',
    OTHER = 'other',
}

export enum ExpenseStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

@Entity('expenses')
@Index(['organisationId'])
@Index(['category'])
@Index(['date'])
export class Expense {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'amount' })
    amount: number;

    @Column({
        type: 'enum',
        enum: ExpenseCategory,
        default: ExpenseCategory.OTHER,
        name: 'category',
    })
    category: ExpenseCategory;

    @Column({ type: 'text', name: 'description' })
    description: string;

    @Column({ type: 'date', name: 'date' })
    date: Date;

    @Column({ type: 'uuid', nullable: true, name: 'incurred_by' })
    incurredBy: string | null;

    @Column({ type: 'text', nullable: true, name: 'receipt_url' })
    receiptUrl: string | null;

    @Column({
        type: 'enum',
        enum: ExpenseStatus,
        default: ExpenseStatus.PENDING,
        name: 'status',
    })
    status: ExpenseStatus;

    @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
    rejectionReason: string | null;

    @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
    approvedBy: string | null;

    @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
    approvedAt: Date | null;

    @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
    updatedBy: string | null;

    @Column({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
