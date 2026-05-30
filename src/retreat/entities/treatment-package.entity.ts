import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

@Entity('treatment_packages')
export class TreatmentPackage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'clinicId' })
    organisationId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'clinicId' })
    organisation: Organisation;

    @Column({ type: 'varchar', length: 255, name: 'name' })
    name: string;

    @Column({ type: 'text', nullable: true, name: 'description' })
    description: string | null;

    @Column({ type: 'int', default: 1, name: 'duration_days' })
    durationDays: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'price' })
    price: number;

    @Column({ type: 'jsonb', nullable: true, name: 'inclusions' })
    inclusions: string[] | null;

    @Column({ type: 'varchar', length: 500, nullable: true, name: 'image_url' })
    imageUrl: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;
}
