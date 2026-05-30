import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Patient } from '../../patients/entities/patient.entity';

@Index(['organisationId', 'patientId', 'recordedAt'])
@Entity('vitals')
export class Vital {
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

  @Column({ type: 'uuid', name: 'recorded_by' })
  recordedBy: string;

  @Column({ type: 'timestamptz', name: 'recorded_at', default: () => 'NOW()' })
  recordedAt: Date;

  @Column({ type: 'varchar', nullable: true, name: 'bp' })
  bp: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'temperature' })
  temperature: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'spo2' })
  spo2: number | null;

  @Column({ type: 'int', nullable: true, name: 'pulse' })
  pulse: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'weight' })
  weight: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'height' })
  height: number | null;

  @Column({ type: 'int', nullable: true, name: 'pain_score' })
  painScore: number | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy: string | null;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
