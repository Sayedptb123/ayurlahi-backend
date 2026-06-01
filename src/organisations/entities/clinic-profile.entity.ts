import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Organisation } from './organisation.entity';

@Entity('clinic_profiles')
export class ClinicProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @OneToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'clinic_name', type: 'varchar', length: 255, nullable: true })
  clinicName: string | null;

  @Column({ name: 'license_number', type: 'varchar', length: 100, nullable: true })
  licenseNumber: string | null;

  @Column({ name: 'gstin', type: 'varchar', length: 50, nullable: true })
  gstin: string | null;

  @Column({ name: 'specialization', type: 'varchar', length: 255, nullable: true })
  specialization: string | null;

  @Column({ name: 'bed_count', type: 'int', nullable: true })
  bedCount: number | null;

  @Column({ name: 'discount_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPct: number;
}
