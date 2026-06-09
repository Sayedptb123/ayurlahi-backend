import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';

@Entity('clinic_capabilities')
export class ClinicCapabilities {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'organisation_id' })
  organisationId: string;

  @OneToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ type: 'boolean', default: true, name: 'has_postnatal_care' })
  hasPostnatalCare: boolean;

  @Column({ type: 'boolean', default: true, name: 'has_ayurveda' })
  hasAyurveda: boolean;

  @Column({ type: 'boolean', default: true, name: 'has_ipd' })
  hasIpd: boolean;

  @Column({ type: 'boolean', default: true, name: 'has_opd' })
  hasOpd: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'", name: 'enabled_modules' })
  enabledModules: string[];

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
