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
@Index(['organizationId'])
@Index(['category'])
@Index(['date'])
export class Expense {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organization_id' })
    organizationId: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({
        type: 'enum',
        enum: ExpenseCategory,
        default: ExpenseCategory.OTHER,
    })
    category: ExpenseCategory;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'date' })
    date: Date;

    @Column({ type: 'uuid', name: 'incurred_by' })
    incurredBy: string;

    @Column({ type: 'text', nullable: true, name: 'receipt_url' })
    receiptUrl: string;

    @Column({
        type: 'enum',
        enum: ExpenseStatus,
        default: ExpenseStatus.PENDING,
    })
    status: ExpenseStatus;

    @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
    rejectionReason: string;

    @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
    approvedBy: string;

    @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
    approvedAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
