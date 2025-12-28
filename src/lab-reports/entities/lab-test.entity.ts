import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LabReport } from './lab-report.entity';

export enum LabTestStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  ABNORMAL = 'abnormal',
}

@Entity('lab_tests')
export class LabTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'labReportId' })
  labReportId: string;

  @Column({ type: 'varchar', length: 255, name: 'testName' })
  testName: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'testCode' })
  testCode: string | null;

  @Column({ type: 'text', nullable: true, name: 'result' })
  result: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'normalRange' })
  normalRange: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'unit' })
  unit: string | null;

  @Column({
    type: 'enum',
    enum: LabTestStatus,
    default: LabTestStatus.PENDING,
    name: 'status',
  })
  status: LabTestStatus;

  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @ManyToOne(() => LabReport, (labReport) => labReport.tests, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'labReportId' })
  labReport: LabReport;
}
