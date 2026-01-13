import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('treatment_packages')
export class TreatmentPackage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'clinicId' })
    clinicId: string;

    @ManyToOne(() => Clinic)
    @JoinColumn({ name: 'clinicId' })
    clinic: Clinic;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'int', default: 1 })
    durationDays: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    price: number;

    // e.g. ["Accommodation", "All Meals", "Daily Abhyangam", "Consultation"]
    @Column({ type: 'jsonb', nullable: true })
    inclusions: string[];

    // For frontend visual appeal
    @Column({ type: 'varchar', length: 500, nullable: true })
    imageUrl: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
