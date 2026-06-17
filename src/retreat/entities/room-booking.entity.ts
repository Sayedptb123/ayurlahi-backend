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
import { BookingEnquiry } from './booking-enquiry.entity';

export enum BookingStatus {
    HELD = 'HELD',
    CONFIRMED = 'CONFIRMED',
    FULFILLED = 'FULFILLED',
    CANCELLED = 'CANCELLED',
    NO_SHOW = 'NO_SHOW',
}

@Entity('room_bookings')
export class RoomBooking {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id' })
    organisation: Organisation;

    @Column({ type: 'uuid', name: 'patient_id', nullable: true })
    patientId: string | null;

    @ManyToOne(() => Patient, { nullable: true })
    @JoinColumn({ name: 'patient_id' })
    patient: Patient | null;

    @Column({ type: 'uuid', name: 'enquiry_id', nullable: true })
    enquiryId: string | null;

    @ManyToOne(() => BookingEnquiry, { nullable: true })
    @JoinColumn({ name: 'enquiry_id' })
    enquiry: BookingEnquiry | null;

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

    @Column({ type: 'date', name: 'check_in_date' })
    checkInDate: Date;

    @Column({ type: 'date', name: 'check_out_date' })
    checkOutDate: Date;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'suggested_price' })
    suggestedPrice: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_price' })
    totalPrice: number;

    @Column({ type: 'text', nullable: true, name: 'discount_reason' })
    discountReason: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'advance_paid' })
    advancePaid: number;

    @Column({
        type: 'enum',
        enum: BookingStatus,
        default: BookingStatus.HELD,
        name: 'status',
    })
    status: BookingStatus;

    @Column({ type: 'boolean', default: false, name: 'ac_required' })
    acRequired: boolean;

    @Column({ type: 'text', nullable: true, name: 'notes' })
    notes: string | null;

    @Column({ type: 'timestamp', nullable: true, name: 'booking_date' })
    bookingDate: Date | null;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
