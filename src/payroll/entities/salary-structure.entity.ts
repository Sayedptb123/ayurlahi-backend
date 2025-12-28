import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Staff } from '../../staff/entities/staff.entity';

@Entity('salary_structures')
export class SalaryStructure {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToOne(() => Staff, (staff) => staff.id, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'staff_id' })
    staff: Staff;

    @Column({ type: 'uuid', name: 'staff_id' })
    @Index({ unique: true })
    staffId: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    baseSalary: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    hra: number; // House Rent Allowance

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    da: number; // Dearness Allowance

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'medical_allowance' })
    medicalAllowance: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'travel_allowance' })
    travelAllowance: number;

    @Column({ type: 'jsonb', nullable: true, default: [] })
    otherAllowances: { name: string; amount: number }[];

    @Column({ type: 'jsonb', nullable: true, default: [] })
    deductions: { name: string; amount: number }[]; // e.g., PF, Tax

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'net_salary' })
    netSalary: number; // Cached calculation

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
