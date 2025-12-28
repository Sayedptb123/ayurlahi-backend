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
@Index(['organizationId'])
@Index(['category'])
@Index(['period'])
export class Budget {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organization_id' })
    organizationId: string;

    @Column({
        type: 'enum',
        enum: ExpenseCategory,
    })
    category: ExpenseCategory;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ type: 'date' }) // Representing the start of the month/period
    period: Date;

    @Column({ type: 'boolean', default: true, name: 'alerts_enabled' })
    alertsEnabled: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
