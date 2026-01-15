import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organisation } from '../../organisations/entities/organisation.entity';

export type OrganisationUserRole =
  | 'SUPER_ADMIN'
  | 'SUPPORT'
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'DOCTOR'
  | 'NURSE'
  | 'THERAPIST'
  | 'PHARMACIST'
  | 'RECEPTIONIST'
  | 'LAB_TECHNICIAN'
  | 'STAFF'
  | 'PATIENT';


@Entity('organisation_users')
@Index(['userId'])
@Index(['organisationId'])
@Index(['role'])
export class OrganisationUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({
    type: 'varchar',
    length: 50,
  })
  role: OrganisationUserRole;

  @Column({ type: 'jsonb', nullable: true })
  permissions: Record<string, any> | null;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

