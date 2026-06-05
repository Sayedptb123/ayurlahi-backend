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
import type { CrmInterestLevel } from '../enums/crm.enums';

/**
 * crm_requirements — structured requirement / feedback capture (B3).
 * Optionally linked to the activity (touch) where it was captured.
 */
@Entity('crm_requirements')
@Index(['leadId'])
@Index(['organisationId'])
export class CrmRequirement {
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

  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  @Column({ type: 'varchar', name: 'interest_level', nullable: true })
  interestLevel: CrmInterestLevel | null;

  @Column({ name: 'modules_wanted', type: 'jsonb', nullable: true })
  modulesWanted: string[] | null;

  @Column({ name: 'pain_points', type: 'text', nullable: true })
  painPoints: string | null;

  @Column({ type: 'text', nullable: true })
  objections: string | null;

  @Column({ name: 'bed_count', type: 'int', nullable: true })
  bedCount: number | null;

  @Column({ name: 'patients_per_month', type: 'int', nullable: true })
  patientsPerMonth: number | null;

  @Column({ type: 'varchar', name: 'decision_maker_name', nullable: true })
  decisionMakerName: string | null;

  @Column({ name: 'spoke_to_decision_maker', type: 'boolean', nullable: true })
  spokeToDecisionMaker: boolean | null;

  @Column({ type: 'varchar', name: 'decision_timeline', nullable: true })
  decisionTimeline: string | null;

  @Column({ type: 'varchar', nullable: true })
  competitor: string | null;

  @Column({ name: 'pricing_discussed', type: 'text', nullable: true })
  pricingDiscussed: string | null;

  @Column({ name: 'pricing_reaction', type: 'text', nullable: true })
  pricingReaction: string | null;

  @Column({ name: 'verbatim_feedback', type: 'text', nullable: true })
  verbatimFeedback: string | null;

  @Column({ name: 'captured_by_user_id', type: 'uuid', nullable: true })
  capturedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
