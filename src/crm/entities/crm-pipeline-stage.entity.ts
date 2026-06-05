import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

/**
 * crm_pipeline_stages — configurable pipeline stages per org (B2).
 * Unique on (organisation_id, key).
 */
@Entity('crm_pipeline_stages')
@Index(['organisationId'])
export class CrmPipelineStage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column()
  key: string;

  @Column()
  label: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_won', default: false })
  isWon: boolean;

  @Column({ name: 'is_lost', default: false })
  isLost: boolean;

  @Column({ name: 'is_side_state', default: false })
  isSideState: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
