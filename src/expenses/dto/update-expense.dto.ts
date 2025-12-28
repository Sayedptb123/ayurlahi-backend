import { PartialType } from '@nestjs/mapped-types';
import { CreateExpenseDto } from './create-expense.dto';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ExpenseStatus } from '../entities/expense.entity';

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {
    @IsOptional()
    @IsEnum(ExpenseStatus)
    status?: ExpenseStatus;

    @IsOptional()
    @IsString()
    rejectionReason?: string;

    @IsOptional()
    @IsUUID()
    approvedBy?: string;
}
