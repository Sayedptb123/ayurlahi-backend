import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { User } from '../../users/entities/user.entity';

@Entity('branches')
@Index(['organisationId', 'deletedAt'])
@Index(['isActive', 'deletedAt'])
@Index(['organisationId', 'isPrimary'], {
  where: 'isPrimary = true AND deletedAt IS NULL',
})
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'whatsapp_number',
  })
  whatsappNumber: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'India' })
  country: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'manager_id' })
  managerId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'manager_id' })
  manager: User | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary: boolean;

  @Column({ type: 'jsonb', nullable: true, name: 'operating_hours' })
  operatingHours: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

