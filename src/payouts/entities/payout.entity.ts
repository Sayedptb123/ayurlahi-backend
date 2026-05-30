import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ type: 'uuid', name: 'order_id', nullable: true })
  orderId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'amount' })
  amount: number;

  @Column({ type: 'varchar', length: 20, name: 'status', default: 'pending' })
  status: PayoutStatus;

  @Column({ type: 'varchar', length: 255, name: 'transaction_ref', nullable: true })
  transactionRef: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
