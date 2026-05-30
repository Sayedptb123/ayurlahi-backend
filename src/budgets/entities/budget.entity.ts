import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
  DeleteDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

// DB enforces UNIQUE(organisation_id, name, period_start) WHERE deleted_at IS NULL
@Index(['organisationId', 'status'])
@Entity('budgets')
export class Budget {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id' })
    organisation: Organisation;

    @Column({ type: 'varchar', length: 255, name: 'name' })
    name: string;

    @Column({ type: 'text', nullable: true, name: 'description' })
    description: string | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount' })
    totalAmount: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'spent_amount' })
    spentAmount: number;

    @Column({ type: 'date', name: 'period_start' })
    periodStart: Date;

    @Column({ type: 'date', name: 'period_end' })
    periodEnd: Date;

    @Column({ type: 'varchar', length: 50, default: 'active', name: 'status' })
    status: string;

    @Column({ type: 'uuid', nullable: true, name: 'created_by' })
    createdBy: string | null;

    @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
    updatedBy: string | null;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
