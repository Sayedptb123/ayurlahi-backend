import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { Batch } from './batch.entity';
import { BatchStage } from './batch-stage.entity';
import { RawMaterial } from './raw-material.entity';

@Entity('wastage_logs')
export class WastageLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'batch_id' })
    batchId: string;

    @ManyToOne(() => Batch)
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @Column({ type: 'uuid', name: 'stage_id', nullable: true })
    stageId: string | null;

    @ManyToOne(() => BatchStage)
    @JoinColumn({ name: 'stage_id' })
    stage: BatchStage | null;

    @Column({ type: 'uuid', name: 'raw_material_id', nullable: true })
    rawMaterialId: string | null;

    @ManyToOne(() => RawMaterial)
    @JoinColumn({ name: 'raw_material_id' })
    rawMaterial: RawMaterial | null;

    @Column({ type: 'decimal', precision: 10, scale: 3 })
    quantity: number; // Amount wasted

    @Column({ type: 'varchar', length: 50 })
    unit: string;

    @Column({ type: 'text', nullable: true })
    reason: string | null; // e.g. "Cleaning Loss", "Spillage"

    @CreateDateColumn({ name: 'recorded_at' })
    recordedAt: Date;
}
