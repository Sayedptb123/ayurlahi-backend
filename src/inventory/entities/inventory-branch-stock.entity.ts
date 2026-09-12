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
import { InventoryItemMaster } from './inventory-item-master.entity';

// ADR-005 Step 2/3 — the per-branch stock half of the split
// (inventory_branch_stock). branchId is nullable (2026-09-12-branch-
// inventory-nullable-branch.sql) -- NULL means "this org has no branches,
// this row IS the org's inventory" (Invariant 2), never "no branch filter
// applied" for a multi-branch org. That distinction is enforced by
// BranchVisibilityService.resolveBranchIdForWrite, not by this entity.
@Entity('inventory_branch_stock')
export class InventoryBranchStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @Column({ name: 'item_master_id', type: 'uuid' })
  itemMasterId: string;

  @ManyToOne(() => InventoryItemMaster, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_master_id' })
  itemMaster: InventoryItemMaster;

  @Column({ name: 'current_stock', default: 0 })
  currentStock: number;

  @Column({ name: 'min_stock_level', default: 10 })
  minStockLevel: number;

  @Column({ name: 'batch_number', type: 'varchar', length: 100, nullable: true })
  batchNumber: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
