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
import { Product } from '../../products/entities/product.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';

@Entity('manufacturers')
@Index(['gstin'], { unique: true })
@Index(['licenseNumber'], { unique: true })
export class Manufacturer extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  companyName: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  gstin: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  licenseNumber: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

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

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionRate: number; // Platform commission percentage

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  // Relations
  @OneToOne(() => User, (user) => user.manufacturer)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Product, (product) => product.manufacturer)
  products: Product[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.manufacturer)
  orderItems: OrderItem[];
}

