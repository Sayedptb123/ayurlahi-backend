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

@Entity('equipment')
export class Equipment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'manufacturer_id' })
    manufacturerId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'manufacturer_id' })
    manufacturer: Organisation;

    @Column({ type: 'varchar', length: 100 })
    name: string; // e.g., "Pulverizer #1", "Boiler A"

    @Column({ type: 'varchar', length: 50, nullable: true })
    model: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true, name: 'serial_number' })
    serialNumber: string | null;

    @Column({ type: 'date', nullable: true, name: 'last_maintenance_date' })
    lastMaintenanceDate: Date | null;

    @Column({ type: 'date', nullable: true, name: 'next_maintenance_date' })
    nextMaintenanceDate: Date | null;

    @Column({ type: 'boolean', default: true, name: 'is_active' })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
