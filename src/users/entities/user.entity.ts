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

  @Column({ type: 'varchar', unique: true, name: 'email' })
  email: string;

  @Column({ type: 'varchar', name: 'password' })
  password: string;

  @Column({ type: 'varchar', name: 'firstName' })
  firstName: string;

  @Column({ type: 'varchar', name: 'lastName' })
  lastName: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'clinic',
    name: 'role',
  })
  role: UserRole;

  @Column({ type: 'varchar', nullable: true, name: 'phone' })
  phone: string | null;

  @Column({ type: 'boolean', default: true, name: 'isActive' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'isEmailVerified' })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', nullable: true, name: 'whatsappNumber' })
  whatsappNumber: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'lastLoginAt' })
  lastLoginAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'clinicId' })
  clinicId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'manufacturerId' })
  manufacturerId: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
