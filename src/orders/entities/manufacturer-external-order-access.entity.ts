import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

// Authorization boundary for the external-order feature only -- not a
// general clinic/manufacturer relationship model. Granted by Ayurlahi Team;
// gates whether a manufacturer may create an order on a specific clinic's
// behalf. See scope/PMS_External_Order_Feature_Scope_2026-09-04.md.
@Entity('manufacturer_external_order_access')
export class ManufacturerExternalOrderAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'manufacturer_id' })
  manufacturerId: string;

  @Column({ type: 'uuid', name: 'clinic_id' })
  clinicId: string;

  @Column({ type: 'uuid', name: 'granted_by' })
  grantedBy: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;
}
