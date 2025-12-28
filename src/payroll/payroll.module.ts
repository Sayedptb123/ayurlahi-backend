import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { SalaryStructure } from './entities/salary-structure.entity';
import { PayrollRecord } from './entities/payroll-record.entity';
import { Staff } from '../staff/entities/staff.entity';

@Module({
    imports: [TypeOrmModule.forFeature([SalaryStructure, PayrollRecord, Staff])],
    controllers: [PayrollController],
    providers: [PayrollService],
    exports: [PayrollService],
})
export class PayrollModule { }
