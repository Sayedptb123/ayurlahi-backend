import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vitals')
export class Vital {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisationId' })
  organisationId: string;

  @Column({ type: 'uuid', name: 'patientId' })
  patientId: string;

  @Column({ type: 'uuid', name: 'recordedBy' })
  recordedBy: string;

  @Column({ type: 'timestamptz', name: 'recordedAt' })
  recordedAt: Date;

  @Column({ type: 'varchar', nullable: true, name: 'bp' })
  bp: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'temperature' })
  temperature: number | null;

  @Column({ type: 'int', nullable: true, name: 'pulse' })
  pulse: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'spo2' })
  spo2: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'weight' })
  weight: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'height' })
  height: number | null;

  @Column({ type: 'int', nullable: true, name: 'painScore' })
  painScore: number | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
