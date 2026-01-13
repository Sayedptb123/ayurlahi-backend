import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { FormulaItem } from './formula-item.entity';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('manufacturing_formulas')
export class ManufacturingFormula {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'manufacturer_id' })
    manufacturerId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'manufacturer_id' })
    manufacturer: Organisation;

    @Column({ type: 'varchar', length: 255 })
    name: string; // e.g., "Standard Chyawanprash Recipe"

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'uuid', name: 'target_product_id', nullable: true })
    targetProductId: string | null;

    @ManyToOne(() => Product)
    @JoinColumn({ name: 'target_product_id' })
    targetProduct: Product | null;

    @Column({ type: 'decimal', precision: 10, scale: 3, name: 'standard_batch_size' })
    standardBatchSize: number; // e.g., 100 kg

    @Column({ type: 'varchar', length: 50, name: 'unit' })
    unit: string; // e.g., kg

    @Column({ type: 'boolean', default: true, name: 'is_active' })
    isActive: boolean;

    @OneToMany(() => FormulaItem, (item) => item.formula, { cascade: true })
    items: FormulaItem[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
