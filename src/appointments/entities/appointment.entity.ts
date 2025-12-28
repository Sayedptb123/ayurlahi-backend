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
import { Doctor } from '../../doctors/entities/doctor.entity';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no-show',
}

export enum AppointmentType {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow-up',
  EMERGENCY = 'emergency',
  CHECKUP = 'checkup',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'clinicId' })
  clinicId: string;

  @Column({ type: 'uuid', name: 'patientId' })
  patientId: string;

  @Column({ type: 'uuid', name: 'doctorId' })
  doctorId: string;

  @Column({ type: 'date', name: 'appointmentDate' })
  appointmentDate: Date;

  @Column({ type: 'time', name: 'appointmentTime' })
  appointmentTime: string; // Format: "HH:mm:ss"

  @Column({ type: 'int', default: 30, name: 'duration' })
  duration: number; // Duration in minutes

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.SCHEDULED,
    name: 'status',
  })
  status: AppointmentStatus;

  @Column({
    type: 'enum',
    enum: AppointmentType,
    default: AppointmentType.CONSULTATION,
    name: 'appointmentType',
  })
  appointmentType: AppointmentType;

  @Column({ type: 'text', nullable: true, name: 'reason' })
  reason: string | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'cancelledAt' })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'cancellationReason' })
  cancellationReason: string | null;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @ManyToOne(() => Doctor)
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
