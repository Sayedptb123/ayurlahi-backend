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

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'clinicId' })
  clinicId: string;

  @Column({ type: 'varchar', length: 50, name: 'patientId' })
  patientId: string;

  @Column({ type: 'varchar', length: 100, name: 'firstName' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, name: 'lastName' })
  lastName: string;

  @Column({ type: 'date', nullable: true, name: 'dateOfBirth' })
  dateOfBirth: Date | null;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
    name: 'gender',
  })
  gender: Gender | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone' })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'email' })
  email: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'address' })
  address: {
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  } | null;

  @Column({ type: 'jsonb', nullable: true, name: 'emergencyContact' })
  emergencyContact: {
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  } | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'bloodGroup' })
  bloodGroup: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'allergies' })
  allergies: string[] | null;

  @Column({ type: 'text', nullable: true, name: 'medicalHistory' })
  medicalHistory: string | null;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
