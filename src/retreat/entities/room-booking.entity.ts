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

    @Column({ type: 'uuid', name: 'clinicId' })
    clinicId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'clinicId' })
    clinic: Organisation;

    // Patient Link
    @Column({ type: 'uuid', name: 'patientId' })
    patientId: string;

    @ManyToOne(() => Patient)
    @JoinColumn({ name: 'patientId' })
    patient: Patient;

    // Room Link
    @Column({ type: 'uuid', name: 'roomId' })
    roomId: string;

    @ManyToOne(() => Room)
    @JoinColumn({ name: 'roomId' })
    room: Room;

    // Package Link (Optional)
    @Column({ type: 'uuid', name: 'packageId', nullable: true })
    packageId: string | null;

    @ManyToOne(() => TreatmentPackage, { nullable: true })
    @JoinColumn({ name: 'packageId' })
    treatmentPackage: TreatmentPackage | null;

    // Booking Dates
    @Column({ type: 'date', name: 'checkInDate' })
    checkInDate: Date;

    @Column({ type: 'date', name: 'checkOutDate' })
    checkOutDate: Date;

    // Pricing
    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'totalPrice' })
    totalPrice: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'advancePaid' })
    advancePaid: number;

    // Status
    @Column({
        type: 'enum',
        enum: BookingStatus,
        default: BookingStatus.PENDING,
    })
    status: BookingStatus;

    // Additional Info
    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'timestamp', nullable: true, name: 'bookingDate' })
    bookingDate: Date;

    // Link to admission (when checked in)
    @Column({ type: 'uuid', nullable: true, name: 'admissionId' })
    admissionId: string | null;

    @CreateDateColumn({ name: 'createdAt' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updatedAt' })
    updatedAt: Date;
}
