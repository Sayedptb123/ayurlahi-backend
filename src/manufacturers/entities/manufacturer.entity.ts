import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

@Entity('manufacturers')
export class Manufacturer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'userId' })
  userId: string;

  @Column({ type: 'varchar', length: 255, name: 'companyName' })
  companyName: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  gstin: string;

  @Column({ type: 'varchar', length: 100, unique: true, name: 'licenseNumber' })
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
  phone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'whatsappNumber' })
  whatsappNumber: string | null;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
    name: 'approvalStatus',
  })
  approvalStatus: ApprovalStatus;

  @Column({ type: 'text', nullable: true, name: 'rejectionReason' })
  rejectionReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  documents: Record<string, any> | null;

  @Column({ type: 'boolean', default: false, name: 'isVerified' })
  isVerified: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'commissionRate' })
  commissionRate: number;

  @Column({ type: 'timestamp', nullable: true, name: 'approvedAt' })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'approvedBy' })
  approvedBy: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'deletedAt' })
  deletedAt: Date | null;
}





