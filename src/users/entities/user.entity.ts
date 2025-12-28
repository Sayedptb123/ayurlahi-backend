import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { UserRole } from '../enums/user-role.enum';

@Entity('users')
@Index(['phone'])
@Index(['email'])
@Index(['isActive'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'password_hash',
  })
  passwordHash: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_email_verified' })
  isEmailVerified: boolean;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLINIC,
    nullable: true,
  })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true, name: 'clinic_id' })
  clinicId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'manufacturer_id' })
  manufacturerId: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
