import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Prescription } from './prescription.entity';

@Entity('prescription_items')
export class PrescriptionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'prescriptionId' })
  prescriptionId: string;

  @Column({ type: 'varchar', length: 255, name: 'medicineName' })
  medicineName: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'dosage' })
  dosage: string | null; // e.g., "500mg"

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'frequency' })
  frequency: string | null; // e.g., "2 times a day"

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'duration' })
  duration: string | null; // e.g., "7 days"

  @Column({ type: 'int', default: 1, name: 'quantity' })
  quantity: number;

  @Column({ type: 'text', nullable: true, name: 'instructions' })
  instructions: string | null;

  @Column({ type: 'int', default: 0, name: 'order' })
  order: number; // Display order

  @ManyToOne(() => Prescription, (prescription) => prescription.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'prescriptionId' })
  prescription: Prescription;
}



