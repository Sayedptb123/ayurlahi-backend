import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryStructure } from './entities/salary-structure.entity';
import { PayrollRecord, PayrollStatus } from './entities/payroll-record.entity';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto';
import { Staff } from '../staff/entities/staff.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PayrollService {
    constructor(
        @InjectRepository(SalaryStructure)
        private salaryStructureRepo: Repository<SalaryStructure>,
        @InjectRepository(PayrollRecord)
        private payrollRecordRepo: Repository<PayrollRecord>,
        @InjectRepository(Staff)
        private staffRepo: Repository<Staff>,
    ) { }

    // --- Salary Structure ---
    async createOrUpdateSalaryStructure(dto: CreateSalaryStructureDto) {
        let structure = await this.salaryStructureRepo.findOne({
            where: { staffId: dto.staffId },
        });

        if (!structure) {
            structure = new SalaryStructure();
            structure.staffId = dto.staffId;
        }

        Object.assign(structure, dto);

        // Calculate Net Salary (This is a simplified calculation)
        const totalAllowances =
            (dto.otherAllowances?.reduce((sum, a) => sum + a.amount, 0) || 0) +
            dto.hra +
            dto.da +
            dto.medicalAllowance +
            dto.travelAllowance;

        const totalDeductions = dto.deductions?.reduce((sum, d) => sum + d.amount, 0) || 0;

        structure.netSalary = dto.baseSalary + totalAllowances - totalDeductions;

        return this.salaryStructureRepo.save(structure);
    }

    async getSalaryStructure(staffId: string) {
        const structure = await this.salaryStructureRepo.findOne({
            where: { staffId },
        });
        if (!structure) throw new NotFoundException('Salary structure not set for this staff');
        return structure;
    }

    // --- Payroll Generation ---
    async generatePayroll(user: User, dto: GeneratePayrollDto) {
        const orgId = user.clinicId || user.manufacturerId;
        if (!orgId) throw new BadRequestException('User not linked to an organization');

        // Check if payroll already exists for this month
        const existing = await this.payrollRecordRepo.findOne({
            where: { organizationId: orgId, month: dto.month, year: dto.year },
        });

        // If we want to allow re-generation, we might delete old drafts?
        // For now, let's block if any records exist to avoid duplicates
        if (existing) {
            // Simple check: if any record exists for this month/year/org
            throw new BadRequestException('Payroll already initiated for this period');
        }

        // specific query for active staff in this org
        const activeStaff = await this.staffRepo.find({
            where: { organizationId: orgId, isActive: true },
        });

        const payrolls: PayrollRecord[] = [];

        for (const staff of activeStaff) {
            const structure = await this.salaryStructureRepo.findOne({
                where: { staffId: staff.id },
            });

            // If no structure, skip or create default (Skip for now and warn)
            if (!structure) continue;

            const record = new PayrollRecord();
            record.organizationId = orgId;
            record.staffId = staff.id;
            record.month = dto.month;
            record.year = dto.year;
            record.basicPay = structure.baseSalary;

            const allowSum =
                structure.hra +
                structure.da +
                structure.medicalAllowance +
                structure.travelAllowance +
                (structure.otherAllowances?.reduce((s, a) => s + a.amount, 0) || 0);

            record.totalAllowances = allowSum;
            record.totalDeductions = structure.deductions?.reduce((s, d) => s + d.amount, 0) || 0;
            record.netPay = structure.netSalary;
            record.status = PayrollStatus.DRAFT;

            payrolls.push(record);
        }

        return this.payrollRecordRepo.save(payrolls);
    }

    async getPayrollRecords(user: User, month?: number, year?: number) {
        const orgId = user.clinicId || user.manufacturerId;
        const where: any = { organizationId: orgId };
        if (month) where.month = month;
        if (year) where.year = year;

        return this.payrollRecordRepo.find({
            where,
            relations: ['staff'],
            order: { year: 'DESC', month: 'DESC' },
        });
    }

    async updatePayrollStatus(id: string, dto: UpdatePayrollStatusDto) {
        const record = await this.payrollRecordRepo.findOne({ where: { id } });
        if (!record) throw new NotFoundException('Payroll record not found');

        Object.assign(record, dto);
        return this.payrollRecordRepo.save(record);
    }
}
