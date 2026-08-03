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
import { Room } from './room.entity';
import { TreatmentPackage } from './treatment-package.entity';

@Entity('room_pricing_overrides')
export class RoomPricingOverride {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id' })
    organisation: Organisation;

    // ADR-004 D15 — denormalized from room/package at write time (both must
    // already agree, enforced in RetreatService.assertSameBranch before
    // save). NULL means "needs branch assignment", never "shared". No OR-NULL.
    @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
    branchId: string | null;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branch_id' })
    branch: Branch | null;

    @Column({ type: 'uuid', name: 'room_id' })
    roomId: string;

    @ManyToOne(() => Room)
    @JoinColumn({ name: 'room_id' })
    room: Room;

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
