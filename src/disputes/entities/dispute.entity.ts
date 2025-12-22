import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

export enum DisputeType {
  ORDER_ISSUE = 'order_issue',
  QUALITY_ISSUE = 'quality_issue',
  DELIVERY_ISSUE = 'delivery_issue',
  PAYMENT_ISSUE = 'payment_issue',
  OTHER = 'other',
}

export enum DisputeStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  clinicId: string;

  @Column({
    type: 'enum',
    enum: DisputeType,
  })
  type: DisputeType;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  comments: Record<string, any>[] | null;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}

