import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Staff } from '../../staff/entities/staff.entity';

@Entity('salary_structures')
export class SalaryStructure {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'staff_id' })
    staffId: string;

    @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'staff_id' })
    staff: Staff;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'base_salary' })
    baseSalary: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'hra' })
    hra: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'da' })
    da: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'medical_allowance' })
    medicalAllowance: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'travel_allowance' })
    travelAllowance: number;

    @Column({ type: 'jsonb', nullable: true, default: [], name: 'other_allowances' })
    otherAllowances: { name: string; amount: number }[];

    @Column({ type: 'jsonb', nullable: true, default: [], name: 'deductions' })
    deductions: { name: string; amount: number }[];

    @Column({ type: 'jsonb', nullable: true, default: [], name: 'allowances' })
    allowances: { name: string; amount: number }[];

    @Column({ type: 'date', nullable: true, name: 'effective_from' })
    effectiveFrom: Date | null;

    @Column({ type: 'date', nullable: true, name: 'effective_to' })
    effectiveTo: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
