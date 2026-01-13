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

    @Column({ type: 'uuid', name: 'clinicId' })
    clinicId: string;

    @ManyToOne(() => Clinic)
    @JoinColumn({ name: 'clinicId' })
    clinic: Clinic;

    @Column({ type: 'varchar', length: 50, name: 'roomNumber' })
    roomNumber: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    floor: string;

    @Column({
        type: 'enum',
        enum: RoomType,
        default: RoomType.PRIVATE,
    })
    type: RoomType;

    @Column({
        type: 'enum',
        enum: RoomStatus,
        default: RoomStatus.AVAILABLE,
    })
    status: RoomStatus;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    pricePerDay: number;

    @Column({ type: 'jsonb', nullable: true })
    amenities: string[];

    @Column({ type: 'text', nullable: true })
    description: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
