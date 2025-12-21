import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from '../../orders/entities/order.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { DisputeStatus } from '../../common/enums/dispute-status.enum';
import { DisputeType } from '../../common/enums/dispute-type.enum';

@Entity('disputes')
@Index(['orderId'])
@Index(['clinicId'])
@Index(['status'])
export class Dispute extends BaseEntity {
  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  clinicId: string;

  @Column({ type: 'enum', enum: DisputeType })
  type: DisputeType;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: {
    images?: string[]; // S3 URLs
    documents?: string[]; // S3 URLs
    notes?: string;
  };

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string; // Support/admin user ID

  @Column({ type: 'text', nullable: true })
  resolution: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  comments: Array<{
    userId: string;
    userName: string;
    comment: string;
    createdAt: Date;
  }>;

  // Relations
  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;
}





