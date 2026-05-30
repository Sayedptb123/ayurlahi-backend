import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Staff } from '../../staff/entities/staff.entity';
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

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @Column({ type: 'uuid', nullable: true, name: 'appointment_id' })
  appointmentId: string | null;

  @Column({ type: 'uuid', name: 'doctor_id' })
  doctorId: string;

  @Column({ type: 'varchar', length: 100, name: 'report_number' })
  reportNumber: string;

  @Column({ type: 'date', name: 'order_date' })
  orderDate: Date;

  @Column({ type: 'date', nullable: true, name: 'collection_date' })
  collectionDate: Date | null;

  @Column({ type: 'date', nullable: true, name: 'report_date' })
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

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'report_file' })
  reportFile: string | null;

  @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Appointment, { nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'doctor_id' })
  doctor: Staff;

  @OneToMany(() => LabTest, (test) => test.labReport, {
    cascade: true,
    eager: true,
  })
  tests: LabTest[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
