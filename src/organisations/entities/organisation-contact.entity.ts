import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Organisation } from './organisation.entity';

@Entity('organisation_contacts')
export class OrganisationContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ type: 'varchar', length: 20, default: 'primary' })
  type: string;

  @Column({ name: 'address_line1', type: 'text', nullable: true })
  addressLine1: string | null;

  @Column({ name: 'address_line2', type: 'text', nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 50, default: 'India' })
  country: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  whatsapp: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;
}
