import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

@Entity('room_categories')
export class RoomCategory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id' })
    organisation: Organisation;

    @Column({ type: 'varchar', length: 100, name: 'name' })
    name: string;

    @Column({ type: 'boolean', default: true, name: 'is_active' })
    isActive: boolean;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
