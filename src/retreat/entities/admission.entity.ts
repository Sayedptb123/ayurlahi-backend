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
import { Patient } from '../../patients/entities/patient.entity';
import { Room } from './room.entity';
import { TreatmentPackage } from './treatment-package.entity';
import { RoomBooking } from './room-booking.entity';

export enum AdmissionStatus {
    ACTIVE = 'ACTIVE',
    DISCHARGED = 'DISCHARGED',
    CANCELLED = 'CANCELLED',
}

@Entity('admissions')
export class Admission {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id' })
    organisation: Organisation;

    @Column({ type: 'uuid', name: 'patient_id' })
    patientId: string;

    @ManyToOne(() => Patient)
    @JoinColumn({ name: 'patient_id' })
    patient: Patient;

    @Column({ type: 'uuid', name: 'room_id' })
    roomId: string;

    @ManyToOne(() => Room)
    @JoinColumn({ name: 'room_id' })
    room: Room;

    @Column({ type: 'uuid', name: 'package_id', nullable: true })
    packageId: string | null;

    @ManyToOne(() => TreatmentPackage, { nullable: true })
    @JoinColumn({ name: 'package_id' })
    treatmentPackage: TreatmentPackage | null;

    @Column({ type: 'uuid', name: 'booking_id', nullable: true })
    bookingId: string | null;

    @ManyToOne(() => RoomBooking, { nullable: true })
    @JoinColumn({ name: 'booking_id' })
    booking: RoomBooking | null;

    @Column({ type: 'timestamp', name: 'check_in_date' })
    checkInDate: Date;

    @Column({ type: 'timestamp', nullable: true, name: 'expected_check_out_date' })
    expectedCheckOutDate: Date | null;

    @Column({ type: 'timestamp', nullable: true, name: 'actual_check_out_date' })
    actualCheckOutDate: Date | null;

    @Column({
        type: 'enum',
        enum: AdmissionStatus,
        default: AdmissionStatus.ACTIVE,
        name: 'status',
    })
    status: AdmissionStatus;

    @Column({ type: 'text', nullable: true, name: 'notes' })
    notes: string | null;

    // Admission-level care-program classifier (postnatal | ayurveda | ipd | opd | …).
    // Plain string, validated in-app against the org's clinic_capabilities — NOT a
    // PG enum (new programs stay data-driven). Classification only; does not affect
    // occupancy/room logic. See POSTNATAL-W1-A.
    @Column({ type: 'varchar', length: 50, nullable: true, name: 'care_program' })
    careProgram: string | null;

    // Calendar date the baby was actually born (postnatal). Third postnatal date
    // after EDD (booking_enquiries) and preferred check-in (room_bookings). Lives
    // here — not on the booking — so walk-in mothers (admission, no booking) can
    // record it. Set at check-in if known, else later via "Mark Delivery". ADR-002 D10.
    @Column({ type: 'date', nullable: true, name: 'actual_delivery_date' })
    actualDeliveryDate: string | null;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
