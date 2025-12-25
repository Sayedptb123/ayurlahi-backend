import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'clinicId' })
  clinicId: string;

  @Column({ type: 'uuid', nullable: true, name: 'userId' })
  userId: string | null;

  @Column({ type: 'varchar', length: 50, name: 'doctorId' })
  doctorId: string;

  @Column({ type: 'varchar', length: 100, name: 'firstName' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, name: 'lastName' })
  lastName: string;

  @Column({ type: 'varchar', length: 255, name: 'specialization' })
  specialization: string;

  @Column({ type: 'jsonb', nullable: true, name: 'qualification' })
  qualification: string[] | null;

  @Column({ type: 'varchar', length: 100, name: 'licenseNumber' })
  licenseNumber: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone' })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'email' })
  email: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'consultationFee',
  })
  consultationFee: number;

  @Column({ type: 'jsonb', nullable: true, name: 'schedule' })
  schedule: {
    monday?: { start: string; end: string; available: boolean };
    tuesday?: { start: string; end: string; available: boolean };
    wednesday?: { start: string; end: string; available: boolean };
    thursday?: { start: string; end: string; available: boolean };
    friday?: { start: string; end: string; available: boolean };
    saturday?: { start: string; end: string; available: boolean };
    sunday?: { start: string; end: string; available: boolean };
  } | null;

  @Column({ type: 'boolean', default: true, name: 'isActive' })
  isActive: boolean;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}



