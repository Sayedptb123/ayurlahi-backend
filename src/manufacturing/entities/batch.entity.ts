import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { ManufacturingFormula } from './manufacturing-formula.entity';
import { Product } from '../../products/entities/product.entity';
import { BatchStage } from './batch-stage.entity';

export enum BatchStatus {
    PLANNED = 'PLANNED',
    IN_PROGRESS = 'IN_PROGRESS',
    QC_PENDING = 'QC_PENDING',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    FAILED = 'FAILED', // Process failure or QC reject
}

@Entity('batches')
export class Batch {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'manufacturer_id' })
    manufacturerId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'manufacturer_id' })
    manufacturer: Organisation;

    @Column({ type: 'varchar', length: 50, unique: true, name: 'batch_number' })
    batchNumber: string;

    @Column({ type: 'uuid', name: 'formula_id', nullable: true })
    formulaId: string | null;

    @ManyToOne(() => ManufacturingFormula)
    @JoinColumn({ name: 'formula_id' })
    formula: ManufacturingFormula | null;

    @Column({ type: 'uuid', name: 'target_product_id', nullable: true })
    targetProductId: string | null;

    @ManyToOne(() => Product)
    @JoinColumn({ name: 'target_product_id' })
    targetProduct: Product | null;

    @Column({ type: 'decimal', precision: 10, scale: 3, name: 'planned_quantity' })
    plannedQuantity: number;

    @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true, name: 'actual_yield' })
    actualYield: number | null;

    @Column({ type: 'varchar', length: 50 })
    status: BatchStatus;

    @Column({ type: 'date', name: 'start_date', nullable: true })
    startDate: Date | null;

    @Column({ type: 'date', name: 'completion_date', nullable: true })
    completionDate: Date | null;

    @Column({ type: 'date', name: 'expiry_date', nullable: true })
    expiryDate: Date | null;

    // Costing
    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_material_cost' })
    totalMaterialCost: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_overhead_cost' })
    totalOverheadCost: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'cost_per_unit' })
    costPerUnit: number;

    @OneToMany(() => BatchStage, (stage) => stage.batch)
    stages: BatchStage[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
