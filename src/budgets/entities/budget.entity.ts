import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { ExpenseCategory } from '../../expenses/entities/expense.entity';

@Entity('budgets')
@Index(['organisationId'])
@Index(['category'])
@Index(['period'])
export class Budget {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @Column({
        type: 'enum',
        enum: ExpenseCategory,
        name: 'category',
    })
    category: ExpenseCategory;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'amount' })
    amount: number;

    @Column({ type: 'date', name: 'period' })
    period: Date;

    @Column({ type: 'boolean', default: true, name: 'alerts_enabled' })
    alertsEnabled: boolean;

    @Column({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
    updatedBy: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
