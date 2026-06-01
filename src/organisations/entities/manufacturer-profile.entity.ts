import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Organisation } from './organisation.entity';

@Entity('manufacturer_profiles')
export class ManufacturerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @OneToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  @Column({ name: 'license_number', type: 'varchar', length: 100, nullable: true })
  licenseNumber: string | null;

  @Column({ name: 'gstin', type: 'varchar', length: 50, nullable: true })
  gstin: string | null;

  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionRate: number;

  @Column({ name: 'mfg_category', type: 'varchar', length: 255, nullable: true })
  mfgCategory: string | null;
}
