import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'clinic' | 'manufacturer' | 'admin' | 'support';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'clinic',
  })
  role: UserRole;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  landphone: string;

  @Column('text', { array: true, nullable: true, name: 'mobile_numbers' })
  mobileNumbers: string[];

  @Column({ nullable: true, name: 'whatsapp_number' })
  whatsappNumber: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ default: false, name: 'is_email_verified' })
  isEmailVerified: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'clinic_id' })
  clinicId: string;

  @Column({ type: 'uuid', nullable: true, name: 'manufacturer_id' })
  manufacturerId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ nullable: true, name: 'last_login_at' })
  lastLoginAt: Date;
}

