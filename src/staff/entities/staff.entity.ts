import {
  Entity,
  Column,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { StaffPosition } from '../../common/enums/staff-position.enum';

@Entity('staff')
@Index(['organizationId', 'organizationType'])
export class Staff extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'enum', enum: ['clinic', 'manufacturer'] })
  organizationType: 'clinic' | 'manufacturer';

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'enum', enum: StaffPosition })
  position: StaffPosition;

  @Column({ type: 'varchar', length: 100, nullable: true })
  positionCustom: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  whatsappNumber: string | null;

  @Column({ type: 'jsonb', nullable: true })
  address: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
  } | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'date', nullable: true })
  dateOfJoining: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salary: number | null;

  @Column({ type: 'text', array: true, nullable: true })
  qualifications: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  specialization: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

