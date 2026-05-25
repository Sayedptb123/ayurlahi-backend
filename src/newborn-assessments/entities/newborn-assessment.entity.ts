import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('newborn_assessments')
export class NewbornAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisationId' })
  organisationId: string;

  @Column({ type: 'uuid', name: 'patientId' })
  patientId: string;

  @Column({ type: 'uuid', name: 'assessedBy' })
  assessedBy: string;

  @Column({ type: 'timestamptz', name: 'assessmentTime' })
  assessmentTime: Date;

  @Column({ type: 'varchar', name: 'assessmentType' })
  assessmentType: string;

  @Column({ type: 'int', nullable: true, name: 'appearance' })
  appearance: number | null;

  @Column({ type: 'int', nullable: true, name: 'pulse' })
  pulse: number | null;

  @Column({ type: 'int', nullable: true, name: 'grimace' })
  grimace: number | null;

  @Column({ type: 'int', nullable: true, name: 'activity' })
  activity: number | null;

  @Column({ type: 'int', nullable: true, name: 'respiration' })
  respiration: number | null;

  @Column({ type: 'int', nullable: true, name: 'apgarTotal' })
  apgarTotal: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true, name: 'weight' })
  weight: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'length' })
  length: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'headCircumference' })
  headCircumference: number | null;

  @Column({ type: 'varchar', nullable: true, name: 'jaundiceLevel' })
  jaundiceLevel: string | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
