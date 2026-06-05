import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { CrmLead } from './crm-lead.entity';

/**
 * crm_visits — geo-tagged site visits (B3, B5).
 * distance_from_registered_m is a measurement captured once at check-in (not a
 * live-computed field); location_mismatch flags check-ins >500m from the
 * registered centre location.
 */
@Entity('crm_visits')
@Index(['leadId'])
@Index(['organisationId'])
@Index(['assignedFieldStaffId'])
@Index(['scheduledAt'])
export class CrmVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'lead_id' })
  leadId: string;

  @ManyToOne(() => CrmLead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: CrmLead;

  @Column({ name: 'assigned_field_staff_id', type: 'uuid' })
  assignedFieldStaffId: string;

  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'check_in_at', type: 'timestamp', nullable: true })
  checkInAt: Date | null;

  @Column({ name: 'check_in_latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  checkInLatitude: number | null;

  @Column({ name: 'check_in_longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  checkInLongitude: number | null;

  @Column({ name: 'check_out_at', type: 'timestamp', nullable: true })
  checkOutAt: Date | null;

  @Column({ name: 'distance_from_registered_m', type: 'decimal', precision: 10, scale: 2, nullable: true })
  distanceFromRegisteredM: number | null;

  @Column({ name: 'location_mismatch', default: false })
  locationMismatch: boolean;

  @Column({ type: 'text', nullable: true })
  outcome: string | null;

  @Column({ name: 'demo_given', default: false })
  demoGiven: boolean;

  @Column({ type: 'varchar', name: 'met_person_name', nullable: true })
  metPersonName: string | null;

  @Column({ name: 'materials_left', type: 'text', nullable: true })
  materialsLeft: string | null;

  @Column({ type: 'jsonb', nullable: true })
  photos: string[] | null;

  @Column({ name: 'consent_signature_url', type: 'text', nullable: true })
  consentSignatureUrl: string | null;

  @Column({ name: 'created_offline', default: false })
  createdOffline: boolean;

  @Column({ name: 'synced_at', type: 'timestamp', nullable: true })
  syncedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
