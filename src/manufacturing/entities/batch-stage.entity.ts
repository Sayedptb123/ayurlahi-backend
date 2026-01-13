import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Batch } from './batch.entity';
import { ProcessStage } from './process-stage.entity';
import { User } from '../../users/entities/user.entity';

export enum StageStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    SKIPPED = 'SKIPPED',
}

@Entity('batch_stages')
export class BatchStage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'batch_id' })
    batchId: string;

    @ManyToOne(() => Batch, (batch) => batch.stages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @Column({ type: 'uuid', name: 'process_stage_id', nullable: true })
    processStageId: string | null;

    @ManyToOne(() => ProcessStage)
    @JoinColumn({ name: 'process_stage_id' })
    processStage: ProcessStage | null;

    @Column({ type: 'varchar', length: 100 })
    name: string; // Copied from ProcessStage or custom

    @Column({ type: 'varchar', length: 50, default: StageStatus.PENDING })
    status: StageStatus;

    @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
    startedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
    completedAt: Date | null;

    @Column({ type: 'uuid', nullable: true, name: 'completed_by' })
    completedBy: string | null;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'completed_by' })
    completedByUser: User | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'int' })
    order: number;
}
