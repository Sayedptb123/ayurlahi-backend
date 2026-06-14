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
import { RoomCategory } from './room-category.entity';

export enum RoomStatus {
    AVAILABLE = 'AVAILABLE',
    OCCUPIED = 'OCCUPIED',
    MAINTENANCE = 'MAINTENANCE',
    CLEANING = 'CLEANING',
}

@Entity('rooms')
export class Room {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id' })
    organisation: Organisation;

    @Column({ type: 'varchar', length: 50, name: 'room_number' })
    roomNumber: string;

    @Column({ type: 'varchar', length: 50, nullable: true, name: 'floor' })
    floor: string | null;

    @Column({ type: 'uuid', nullable: true, name: 'room_category_id' })
    roomCategoryId: string | null;

    @ManyToOne(() => RoomCategory, { nullable: true })
    @JoinColumn({ name: 'room_category_id' })
    roomCategory: RoomCategory | null;

    @Column({
        type: 'enum',
        enum: RoomStatus,
        default: RoomStatus.AVAILABLE,
        name: 'status',
    })
    status: RoomStatus;

    @Column({ type: 'integer', nullable: true, name: 'capacity' })
    capacity: number | null;

    @Column({ type: 'jsonb', nullable: true, name: 'amenities' })
    amenities: string[] | null;

    @Column({ type: 'text', nullable: true, name: 'description' })
    description: string | null;

    @Column({ type: 'boolean', default: true, name: 'is_active' })
    isActive: boolean;

    @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
    branchId: string | null;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
