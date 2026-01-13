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
import { Patient } from '../../patients/entities/patient.entity';
import { Room } from './room.entity';
import { TreatmentPackage } from './treatment-package.entity';

export enum AdmissionStatus {
    ACTIVE = 'ACTIVE',
    DISCHARGED = 'DISCHARGED',
    CANCELLED = 'CANCELLED',
    PLANNED = 'PLANNED',
}

@Entity('admissions')
export class Admission {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'clinicId' })
    clinicId: string;

    @ManyToOne(() => Clinic)
    @JoinColumn({ name: 'clinicId' })
    clinic: Clinic;

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

    // Package Link (Optional - could be custom stay)
    @Column({ type: 'uuid', name: 'packageId', nullable: true })
    packageId: string | null;

    @ManyToOne(() => TreatmentPackage, { nullable: true })
    @JoinColumn({ name: 'packageId' })
    treatmentPackage: TreatmentPackage | null;

    @Column({ type: 'timestamp' })
    checkInDate: Date;

    @Column({ type: 'timestamp', nullable: true })
    expectedCheckOutDate: Date;

    @Column({ type: 'timestamp', nullable: true })
    actualCheckOutDate: Date | null;

    @Column({
        type: 'enum',
        enum: AdmissionStatus,
        default: AdmissionStatus.ACTIVE,
    })
    status: AdmissionStatus;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
