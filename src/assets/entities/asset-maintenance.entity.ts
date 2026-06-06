import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Asset } from './asset.entity';
import { User } from '../../users/entities/user.entity';

export enum MaintenanceType {
  ROUTINE = 'routine',
  REPAIR = 'repair',
  CALIBRATION = 'calibration',
  UPGRADE = 'upgrade',
}

@Entity('asset_maintenance')
export class AssetMaintenance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'asset_id' })
  assetId: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'maintenance_type',
  })
  maintenanceType: MaintenanceType;

  @Column({ type: 'date', name: 'maintenance_date' })
  maintenanceDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'service_provider' })
  serviceProvider: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'date', nullable: true, name: 'next_maintenance_date' })
  nextMaintenanceDate: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'payment_id' })
  paymentId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'performed_by' })
  performedBy: string | null;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by' })
  performedByUser: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
