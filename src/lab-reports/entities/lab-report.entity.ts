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
import { LabTest } from './lab-test.entity';

export enum LabReportStatus {
  ORDERED = 'ordered',
  SAMPLE_COLLECTED = 'sample-collected',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('lab_reports')
export class LabReport {
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

  @Column({ type: 'varchar', length: 100, unique: true, name: 'reportNumber' })
  reportNumber: string;

  @Column({ type: 'date', name: 'orderDate' })
  orderDate: Date;

  @Column({ type: 'date', nullable: true, name: 'collectionDate' })
  collectionDate: Date | null;

  @Column({ type: 'date', nullable: true, name: 'reportDate' })
  reportDate: Date | null;

  @Column({
    type: 'enum',
    enum: LabReportStatus,
    default: LabReportStatus.ORDERED,
    name: 'status',
  })
  status: LabReportStatus;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'reportFile' })
  reportFile: string | null; // PDF URL

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

  @OneToMany(() => LabTest, (test) => test.labReport, {
    cascade: true,
    eager: true,
  })
  tests: LabTest[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}

