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

  @Column({ type: 'uuid', name: 'orderId' })
  orderId: string;

  @Column({ type: 'uuid', name: 'clinicId' })
  organisationId: string;

  @Column({
    type: 'enum',
    enum: DisputeType,
    name: 'type',
  })
  type: DisputeType;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
    name: 'status',
  })
  status: DisputeStatus;

  @Column({ type: 'text', name: 'description' })
  description: string;

  @Column({ type: 'jsonb', nullable: true, name: 'evidence' })
  evidence: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true, name: 'assignedTo' })
  assignedTo: string | null;

  @Column({ type: 'text', nullable: true, name: 'resolution' })
  resolution: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'resolvedAt' })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'resolvedBy' })
  resolvedBy: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'comments' })
  comments: Record<string, any>[] | null;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'deletedAt' })
  deletedAt: Date | null;
}
