import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { ManufacturingFormula } from './manufacturing-formula.entity';
import { RawMaterial } from './raw-material.entity';

@Entity('formula_items')
export class FormulaItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'formula_id' })
    formulaId: string;

    @ManyToOne(() => ManufacturingFormula, (formula) => formula.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'formula_id' })
    formula: ManufacturingFormula;

    @Column({ type: 'uuid', name: 'raw_material_id' })
    rawMaterialId: string;

    @ManyToOne(() => RawMaterial)
    @JoinColumn({ name: 'raw_material_id' })
    rawMaterial: RawMaterial;

    @Column({ type: 'decimal', precision: 10, scale: 3 })
    quantity: number; // Required quantity for the standard batch size

    @Column({ type: 'varchar', length: 100, nullable: true })
    stage: string | null; // e.g., "Cleaning", "Boiling" - when this ingredient is added

    @Column({ type: 'text', nullable: true })
    notes: string | null;
}
