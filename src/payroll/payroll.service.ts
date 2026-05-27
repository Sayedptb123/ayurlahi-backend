import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryStructure } from './entities/salary-structure.entity';
import { PayrollRecord, PayrollStatus } from './entities/payroll-record.entity';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto';
import { Staff } from '../staff/entities/staff.entity';
import { NotificationsService } from '../notifications/notifications.service';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type RequestUser = { userId: string; organisationId: string; role?: string; organisationType?: string };

@Injectable()
export class PayrollService {
    constructor(
        @InjectRepository(SalaryStructure)
        private salaryStructureRepo: Repository<SalaryStructure>,
        @InjectRepository(PayrollRecord)
        private payrollRecordRepo: Repository<PayrollRecord>,
        @InjectRepository(Staff)
        private staffRepo: Repository<Staff>,
        private readonly notificationsService: NotificationsService,
    ) { }

    async createOrUpdateSalaryStructure(reqUser: RequestUser, dto: CreateSalaryStructureDto) {
        const orgId = reqUser.organisationId;
        if (!orgId) throw new BadRequestException('User not linked to an organisation');

        // Verify the staff member belongs to the caller's organisation
        const staff = await this.staffRepo.findOne({
            where: { id: dto.staffId, organisationId: orgId },
        });
        if (!staff) throw new ForbiddenException('Staff member not found in your organisation');

        let structure = await this.salaryStructureRepo.findOne({
            where: { staffId: dto.staffId },
        });

        if (!structure) {
            structure = new SalaryStructure();
            structure.staffId = dto.staffId;
        }

        Object.assign(structure, dto);

        return this.salaryStructureRepo.save(structure);
    }

    async getSalaryStructure(staffId: string) {
        const structure = await this.salaryStructureRepo.findOne({
            where: { staffId },
        });
        if (!structure) throw new NotFoundException('Salary structure not set for this staff');
        return structure;
    }

    async generatePayroll(reqUser: RequestUser, dto: GeneratePayrollDto) {
        const orgId = reqUser.organisationId;
        if (!orgId) throw new BadRequestException('User not linked to an organization');

        const existing = await this.payrollRecordRepo.findOne({
            where: { organisationId: orgId, month: dto.month, year: dto.year },
        });

        if (existing) {
            throw new BadRequestException('Payroll already initiated for this period');
        }

        const activeStaff = await this.staffRepo.find({
            where: { organisationId: orgId, isActive: true },
        });

        const payrolls: PayrollRecord[] = [];

        for (const staff of activeStaff) {
            const structure = await this.salaryStructureRepo.findOne({
                where: { staffId: staff.id },
            });

            if (!structure) continue;

            const allowSum =
                parseFloat(structure.hra as any) +
                parseFloat(structure.da as any) +
                parseFloat(structure.medicalAllowance as any) +
                parseFloat(structure.travelAllowance as any) +
                (structure.otherAllowances?.reduce((s, a) => s + a.amount, 0) || 0);

            const deductSum = structure.deductions?.reduce((s, d) => s + d.amount, 0) || 0;
            const baseSalary = parseFloat(structure.baseSalary as any);
            const netPay = baseSalary + allowSum - deductSum;

            const record = new PayrollRecord();
            record.organisationId = orgId;
            record.staffId = staff.id;
            record.month = dto.month;
            record.year = dto.year;
            record.basicPay = baseSalary;
            record.totalAllowances = allowSum;
            record.totalDeductions = deductSum;
            record.netPay = netPay;
            record.status = PayrollStatus.DRAFT;

            payrolls.push(record);
        }

        return this.payrollRecordRepo.save(payrolls);
    }

    async getPayrollRecords(reqUser: RequestUser, month?: number, year?: number) {
        return [];
    }

    async updatePayrollStatus(id: string, dto: UpdatePayrollStatusDto) {
        const record = await this.payrollRecordRepo.findOne({ where: { id } });
        if (!record) throw new NotFoundException('Payroll record not found');

        const previousStatus = record.status;
        Object.assign(record, dto);
        const saved = await this.payrollRecordRepo.save(record);

        // Notify the staff member when salary is approved or paid
        if (dto.status && dto.status !== previousStatus) {
            const staff = await this.staffRepo.findOne({ where: { id: saved.staffId } });
            if (staff?.userId) {
                const monthName = MONTH_NAMES[(saved.month ?? 1) - 1] ?? '';
                const netPay = `₹${parseFloat(saved.netPay as any).toLocaleString('en-IN')}`;

                if (dto.status === PayrollStatus.PAID) {
                    this.notificationsService.sendToUsers({
                        userIds: [staff.userId],
                        title: 'Salary Credited',
                        body: `Your salary of ${netPay} for ${monthName} ${saved.year} has been credited.`,
                        data: { payrollId: saved.id, type: 'salary_credited' },
                    }).catch(() => {});
                } else if ((dto.status as string) === 'approved') {
                    this.notificationsService.sendToUsers({
                        userIds: [staff.userId],
                        title: 'Salary Processed',
                        body: `Your salary for ${monthName} ${saved.year} (${netPay}) has been processed and will be credited shortly.`,
                        data: { payrollId: saved.id, type: 'salary_processed' },
                    }).catch(() => {});
                }
            }
        }

        return saved;
    }
}
