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
import { Branch } from '../../branches/entities/branch.entity';
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

export enum RefundMethod {
    CASH = 'CASH',
    UPI = 'UPI',
    BANK_TRANSFER = 'BANK_TRANSFER',
    CARD = 'CARD',
    OTHER = 'OTHER',
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

    // ADR-004 D9. NULL = organisation-wide.
    @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
    branchId: string | null;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branch_id' })
    branch: Branch | null;

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

    // Refund resolution for a CANCELLED booking's advance_paid -- advance_paid
    // itself is never mutated (historical snapshot of what was actually
    // collected); refundedAt IS NOT NULL is the single source of truth for
    // "has a refund been recorded" (see removeBooking() in retreat.service.ts).
    // Exactly one refund record per booking by product decision -- amount can
    // be a partial or full return of advance_paid, but is captured once, not
    // as a ledger of installments. See scope/Handoff_Blocker_Fixes_2026-09-16.md.
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'refund_amount' })
    refundAmount: number | null;

    @Column({ type: 'enum', enum: RefundMethod, nullable: true, name: 'refund_method' })
    refundMethod: RefundMethod | null;

    @Column({ type: 'text', nullable: true, name: 'refund_note' })
    refundNote: string | null;

    // Plain uuid, no FK relation -- same convention as organisation_id/
    // cancelled_by elsewhere in this codebase.
    @Column({ type: 'uuid', nullable: true, name: 'refunded_by' })
    refundedBy: string | null;

    @Column({ type: 'timestamp', nullable: true, name: 'refunded_at' })
    refundedAt: Date | null;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
