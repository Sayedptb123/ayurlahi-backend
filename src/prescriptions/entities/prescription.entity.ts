import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { PrescriptionItem } from './prescription-item.entity';

export enum PrescriptionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'clinicId' })
  clinicId: string;

  @Column({ type: 'uuid', name: 'patientId' })
  patientId: string;

  @Column({ type: 'uuid', nullable: true, name: 'appointmentId' })
  appointmentId: string | null;

  @Column({ type: 'uuid', name: 'doctorId' })
  doctorId: string;

  @Column({ type: 'date', name: 'prescriptionDate' })
  prescriptionDate: Date;

  @Column({ type: 'text', name: 'diagnosis' })
  diagnosis: string;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.ACTIVE,
    name: 'status',
  })
  status: PrescriptionStatus;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @ManyToOne(() => Appointment, { nullable: true })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment | null;

  @ManyToOne(() => Doctor)
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @OneToMany(() => PrescriptionItem, (item) => item.prescription, {
    cascade: true,
    eager: true,
  })
  items: PrescriptionItem[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
