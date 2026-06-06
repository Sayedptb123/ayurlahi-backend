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
import { Branch } from '../../branches/entities/branch.entity';
import { AssetCategory } from './asset-category.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { Staff } from '../../staff/entities/staff.entity';

export enum AssetStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
  DISPOSED = 'disposed',
  LOST = 'lost',
}

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
  branchId: string | null;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId: string;

  @Column({ type: 'varchar', length: 100, name: 'asset_code' })
  assetCode: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'serial_number' })
  serialNumber: string | null;

  @Column({ type: 'date', nullable: true, name: 'purchase_date' })
  purchaseDate: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'purchase_price' })
  purchasePrice: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vendor: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'purchase_order_id' })
  purchaseOrderId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_to_staff_id' })
  assignedToStaffId: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: AssetStatus.ACTIVE,
    name: 'status',
  })
  status: AssetStatus;

  @Column({ type: 'date', nullable: true, name: 'last_maintenance_date' })
  lastMaintenanceDate: Date | null;

  @Column({ type: 'date', nullable: true, name: 'next_maintenance_date' })
  nextMaintenanceDate: Date | null;

  @Column({ type: 'int', nullable: true, name: 'maintenance_interval_days' })
  maintenanceIntervalDays: number | null;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => AssetCategory)
  @JoinColumn({ name: 'category_id' })
  category: AssetCategory;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder | null;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'assigned_to_staff_id' })
  assignedToStaff: Staff | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
