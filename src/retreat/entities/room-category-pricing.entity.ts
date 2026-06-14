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
import { TreatmentPackage } from './treatment-package.entity';

@Entity('room_category_pricing')
export class RoomCategoryPricing {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id' })
    organisation: Organisation;

    @Column({ type: 'uuid', name: 'room_category_id' })
    roomCategoryId: string;

    @ManyToOne(() => RoomCategory)
    @JoinColumn({ name: 'room_category_id' })
    roomCategory: RoomCategory;

    @Column({ type: 'uuid', name: 'package_id' })
    packageId: string;

    @ManyToOne(() => TreatmentPackage)
    @JoinColumn({ name: 'package_id' })
    package: TreatmentPackage;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'price' })
    price: number;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
