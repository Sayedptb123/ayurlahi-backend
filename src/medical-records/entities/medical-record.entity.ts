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
import { Appointment } from '../../appointments/entities/appointment.entity';

@Entity('medical_records')
export class MedicalRecord {
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

  @Column({ type: 'date', name: 'visitDate' })
  visitDate: Date;

  @Column({ type: 'text', name: 'chiefComplaint' })
  chiefComplaint: string;

  @Column({ type: 'text', name: 'diagnosis' })
  diagnosis: string;

  @Column({ type: 'text', name: 'treatment' })
  treatment: string;

  @Column({ type: 'jsonb', nullable: true, name: 'vitals' })
  vitals: {
    bloodPressure?: string; // e.g., "120/80"
    temperature?: number; // in Celsius or Fahrenheit
    pulse?: number; // beats per minute
    respiratoryRate?: number; // breaths per minute
    weight?: number; // in kg
    height?: number; // in cm
    bmi?: number;
    oxygenSaturation?: number; // SpO2 percentage
    glucose?: number; // blood glucose level
    [key: string]: any; // Allow additional vitals
  } | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'attachments' })
  attachments: string[] | null; // Array of file URLs

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

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}



