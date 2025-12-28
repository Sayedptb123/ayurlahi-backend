import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PatientBill } from './patient-bill.entity';

export enum BillItemType {
  CONSULTATION = 'consultation',
  MEDICINE = 'medicine',
  LAB_TEST = 'lab-test',
  PROCEDURE = 'procedure',
  OTHER = 'other',
}

@Entity('bill_items')
export class BillItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'billId' })
  billId: string;

  @Column({
    type: 'enum',
    enum: BillItemType,
    name: 'itemType',
  })
  itemType: BillItemType;

  @Column({ type: 'varchar', length: 255, name: 'itemName' })
  itemName: string;

  @Column({ type: 'int', default: 1, name: 'quantity' })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'unitPrice',
  })
  unitPrice: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'discount',
  })
  discount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'total',
  })
  total: number;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description: string | null;

  @ManyToOne(() => PatientBill, (bill) => bill.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'billId' })
  bill: PatientBill;
}
