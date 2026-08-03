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
import { Branch } from '../../branches/entities/branch.entity';
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

    // ADR-004 D15 — denormalized from roomCategory/package at write time (both
    // must already agree, enforced in RetreatService.assertSameBranch before
    // save). NULL means "needs branch assignment", never "shared". No OR-NULL.
    @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
    branchId: string | null;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branch_id' })
    branch: Branch | null;

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

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'base_price' })
    basePrice: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'ac_supplement_per_day' })
    acSupplementPerDay: number | null;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
