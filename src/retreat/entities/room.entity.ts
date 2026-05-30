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

export enum RoomType {
    SUITE = 'SUITE',
    DELUXE = 'DELUXE',
    PRIVATE = 'PRIVATE',
    WARD = 'WARD',
}

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

    @Column({
        type: 'enum',
        enum: RoomType,
        default: RoomType.PRIVATE,
        name: 'type',
    })
    type: RoomType;

    @Column({
        type: 'enum',
        enum: RoomStatus,
        default: RoomStatus.AVAILABLE,
        name: 'status',
    })
    status: RoomStatus;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'price_per_day' })
    pricePerDay: number;

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
