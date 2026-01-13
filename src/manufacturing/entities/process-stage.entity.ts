import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

@Entity('process_stages')
export class ProcessStage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'manufacturer_id' })
    manufacturerId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'manufacturer_id' })
    manufacturer: Organisation;

    @Column({ type: 'varchar', length: 100 })
    name: string; // e.g., "Cleaning", "Boiling", "Fermentation"

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'int', default: 0 })
    order: number; // Default order for display

    @Column({ type: 'boolean', default: false, name: 'requires_machine' })
    requiresMachine: boolean; // Does this stage need equipment?

    @Column({ type: 'boolean', default: false, name: 'requires_qc' })
    requiresQc: boolean; // Does this stage need a Quality Check?

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
