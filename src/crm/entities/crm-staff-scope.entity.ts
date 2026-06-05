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
 * crm_staff_scopes — per-staff data scope (territory). Each non-empty array
 * restricts the leads a staff member can see on that dimension; empty/null =
 * no restriction. Enforced server-side on top of role isolation.
 * Unique on (organisation_id, user_id).
 */
@Entity('crm_staff_scopes')
@Index(['organisationId'])
export class CrmStaffScope {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'jsonb', nullable: true })
  states: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  districts: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  stages: string[] | null;

  @Column({ name: 'centre_types', type: 'jsonb', nullable: true })
  centreTypes: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  priorities: string[] | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
