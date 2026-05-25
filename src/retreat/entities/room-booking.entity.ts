import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Room } from './room.entity';
import { TreatmentPackage } from './treatment-package.entity';

export enum BookingStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    CHECKED_IN = 'CHECKED_IN',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
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

    @Column({ type: 'date', name: 'check_in_date' })
    checkInDate: Date;

    @Column({ type: 'date', name: 'check_out_date' })
    checkOutDate: Date;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_price' })
    totalPrice: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'advance_paid' })
    advancePaid: number;

    @Column({
        type: 'enum',
        enum: BookingStatus,
        default: BookingStatus.PENDING,
        name: 'status',
    })
    status: BookingStatus;

    @Column({ type: 'text', nullable: true, name: 'notes' })
    notes: string | null;

    @Column({ type: 'timestamp', nullable: true, name: 'booking_date' })
    bookingDate: Date | null;

    @Column({ type: 'uuid', nullable: true, name: 'admission_id' })
    admissionId: string | null;

    @Column({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
