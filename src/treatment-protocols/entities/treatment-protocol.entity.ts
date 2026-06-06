import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TreatmentProtocolItem } from './treatment-protocol-item.entity';

/**
 * treatment_protocols — Phase 24C.3 (data-model groundwork). A named expected
 * medicine consumption for a treatment/package (e.g. "28-day Sutika package").
 * The forecasting consumer is deferred; this just lets a protocol BOM be authored.
 */
@Entity('treatment_protocols')
@Index(['organisationId'])
export class TreatmentProtocol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'package_id', type: 'uuid', nullable: true })
  packageId: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => TreatmentProtocolItem, (item) => item.protocol, {
    cascade: true,
  })
  items: TreatmentProtocolItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
