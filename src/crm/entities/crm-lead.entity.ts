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
import type { CrmCentreType, CrmPriority } from '../enums/crm.enums';

/**
 * crm_leads — a prospect Ayurvedic / postnatal centre in the sales pipeline.
 * Owned by the AYURLAHI_TEAM org. See scope/Medilink_CRM_Final_Brief.md B3.
 *
 * Numeric columns (latitude/longitude/rating) come back as strings from
 * PostgreSQL — wrap with parseFloat() before arithmetic (hard rule #5).
 */
@Entity('crm_leads')
@Index(['organisationId'])
@Index(['assignedTelecallerId'])
@Index(['assignedFieldStaffId'])
@Index(['stage'])
export class CrmLead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column()
  name: string;

  @Column({ type: 'varchar', name: 'centre_type', nullable: true })
  centreType: CrmCentreType | null;

  @Column({ name: 'bed_count', type: 'int', nullable: true })
  bedCount: number | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  area: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  district: string | null;

  @Column({ type: 'varchar', nullable: true })
  state: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', name: 'primary_contact_name', nullable: true })
  primaryContactName: string | null;

  @Column({ type: 'varchar', name: 'primary_contact_designation', nullable: true })
  primaryContactDesignation: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', name: 'phone_secondary', nullable: true })
  phoneSecondary: string | null;

  @Column({ type: 'varchar', nullable: true })
  whatsapp: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', name: 'lead_source', nullable: true })
  leadSource: string | null;

  @Column({ type: 'varchar', name: 'owner_doctor_name', nullable: true })
  ownerDoctorName: string | null;

  @Column({ name: 'owner_doctor_is_bams', type: 'boolean', nullable: true })
  ownerDoctorIsBams: boolean | null;

  @Column({ type: 'varchar', name: 'current_software', nullable: true })
  currentSoftware: string | null;

  @Column({ name: 'assigned_telecaller_id', type: 'uuid', nullable: true })
  assignedTelecallerId: string | null;

  @Column({ name: 'assigned_field_staff_id', type: 'uuid', nullable: true })
  assignedFieldStaffId: string | null;

  @Column({ default: 'new' })
  stage: string;

  @Column({ type: 'varchar', default: 'warm' })
  priority: CrmPriority;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ name: 'lost_reason', type: 'text', nullable: true })
  lostReason: string | null;

  @Column({ type: 'varchar', name: 'google_place_id', nullable: true })
  googlePlaceId: string | null;

  @Column({ name: 'google_maps_url', type: 'text', nullable: true })
  googleMapsUrl: string | null;

  @Column({ type: 'text', nullable: true })
  website: string | null;

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating: number | null;

  @Column({ name: 'user_ratings_total', type: 'int', nullable: true })
  userRatingsTotal: number | null;

  @Column({ name: 'is_incomplete', default: false })
  isIncomplete: boolean;

  @Column({ name: 'duplicate_of_lead_id', type: 'uuid', nullable: true })
  duplicateOfLeadId: string | null;

  @Column({ name: 'onboarded_organisation_id', type: 'uuid', nullable: true })
  onboardedOrganisationId: string | null;

  @Column({ name: 'last_contacted_at', type: 'timestamp', nullable: true })
  lastContactedAt: Date | null;

  @Column({ name: 'next_follow_up_at', type: 'timestamp', nullable: true })
  nextFollowUpAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
