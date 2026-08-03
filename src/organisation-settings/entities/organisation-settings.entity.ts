import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

export enum PatientVisibility {
  SHARED = 'shared',
  ISOLATED = 'isolated',
}

export enum StaffPolicy {
  MULTI_BRANCH = 'multi_branch',
  SINGLE_BRANCH = 'single_branch',
}

export enum BillingPolicy {
  PER_BRANCH = 'per_branch',
}

export enum ReportingPolicy {
  BOTH = 'both',
}

export enum InventoryPolicy {
  SHARED = 'shared',
}

export enum NumberingPolicy {
  ORG_WIDE = 'org_wide',
}

export enum AppointmentPolicy {
  AUTO = 'auto',
  CUSTOM = 'custom',
}

// ADR-004 D12 — 1:1 satellite for per-organisation operational policy, kept
// separate from Organisation (identity) so that table doesn't become a
// god-table as more policies get added. Only patientVisibility/staffPolicy
// are ever asked of the customer (D2); the rest are internal defaults today.
@Entity('organisation_settings')
export class OrganisationSettings {
  @PrimaryColumn({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'varchar', length: 20, default: PatientVisibility.ISOLATED, name: 'patient_visibility' })
  patientVisibility: PatientVisibility;

  @Column({ type: 'varchar', length: 20, default: StaffPolicy.MULTI_BRANCH, name: 'staff_policy' })
  staffPolicy: StaffPolicy;

  @Column({ type: 'varchar', length: 20, default: BillingPolicy.PER_BRANCH, name: 'billing_policy' })
  billingPolicy: BillingPolicy;

  @Column({ type: 'varchar', length: 20, default: ReportingPolicy.BOTH, name: 'reporting_policy' })
  reportingPolicy: ReportingPolicy;

  @Column({ type: 'varchar', length: 20, default: InventoryPolicy.SHARED, name: 'inventory_policy' })
  inventoryPolicy: InventoryPolicy;

  @Column({ type: 'varchar', length: 20, default: NumberingPolicy.ORG_WIDE, name: 'numbering_policy' })
  numberingPolicy: NumberingPolicy;

  @Column({ type: 'varchar', length: 20, default: AppointmentPolicy.AUTO, name: 'appointment_policy' })
  appointmentPolicy: AppointmentPolicy;

  @OneToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
