import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { UserRole } from '../../common/enums/role.enum';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Manufacturer } from '../../manufacturers/entities/manufacturer.entity';

@Entity('users')
@Index(['email'], { unique: true })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  whatsappNumber: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  address: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
  } | null;

  // Relations
  @OneToOne(() => Clinic, (clinic) => clinic.user, { nullable: true })
  @JoinColumn()
  clinic?: Clinic;

  @OneToOne(() => Manufacturer, (manufacturer) => manufacturer.user, {
    nullable: true,
  })
  @JoinColumn()
  manufacturer?: Manufacturer;
}

