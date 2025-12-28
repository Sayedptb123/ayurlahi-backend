import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
import { PayrollStatus } from '../entities/payroll-record.entity';

export class UpdatePayrollStatusDto {
    @IsEnum(PayrollStatus)
    status: PayrollStatus;

    @IsOptional()
    @IsString()
    transactionRef?: string;

    @IsOptional()
    @IsDateString()
    paymentDate?: string;
}
