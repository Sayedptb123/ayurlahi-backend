import {
  Entity,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity('clinics')
@Index(['gstin'], { unique: true, where: '"gstin" IS NOT NULL' })
@Index(['licenseNumber'], { unique: true })
export class Clinic extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  clinicName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gstin: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  licenseNumber: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'varchar', length: 10 })
  pincode: string;

  @Column({ type: 'varchar', length: 50 })
  country: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  whatsappNumber: string;

  @Column({ type: 'enum', enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' })
  approvalStatus: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'jsonb', nullable: true })
  documents: {
    license?: string;
    gstCertificate?: string;
    addressProof?: string;
  };

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  // Relations
  @OneToOne(() => User, (user) => user.clinic)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Order, (order) => order.clinic)
  orders: Order[];

  @OneToMany(() => Subscription, (subscription) => subscription.clinic)
  subscriptions: Subscription[];
}

