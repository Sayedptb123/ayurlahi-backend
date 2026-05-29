import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('feeding_logs')
export class FeedingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisationId' })
  organisationId: string;

  @Column({ type: 'uuid', name: 'patientId' })
  patientId: string;

  @Column({ type: 'uuid', nullable: true, name: 'motherPatientId' })
  motherPatientId: string | null;

  @Column({ type: 'uuid', name: 'recordedBy' })
  recordedBy: string;

  @Column({ type: 'timestamptz', name: 'feedingTime' })
  feedingTime: Date;

  @Column({ type: 'varchar', name: 'feedingType' })
  feedingType: string;

  @Column({ type: 'int', nullable: true, name: 'durationMinutes' })
  durationMinutes: number | null;

  @Column({ type: 'decimal', precision: 7, scale: 2, nullable: true, name: 'quantityMl' })
  quantityMl: number | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
