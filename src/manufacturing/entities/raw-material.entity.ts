import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

@Entity('raw_materials')
export class RawMaterial {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'manufacturer_id' })
    manufacturerId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'manufacturer_id' })
    manufacturer: Organisation;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'varchar', length: 100, unique: true })
    sku: string; // Stock Keeping Unit

    @Column({ type: 'varchar', length: 50 })
    unit: string; // e.g., kg, g, liters

    @Column({ type: 'decimal', precision: 10, scale: 3, default: 0, name: 'current_stock' })
    currentStock: number;

    @Column({ type: 'decimal', precision: 10, scale: 3, default: 0, name: 'reorder_point' })
    reorderPoint: number; // Low stock alert level

    @Column({ type: 'boolean', default: true, name: 'is_active' })
    isActive: boolean;

    @Column({ type: 'date', nullable: true, name: 'expiry_date' })
    expiryDate: Date | null; // Track nearest expiry of bulk stock (simplified)

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
