import {
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    IsDateString,
    Min,
    MaxLength,
} from 'class-validator';
import { ExpenseCategory, ExpenseStatus } from '../entities/expense.entity';

export class CreateExpenseDto {
    @IsNumber()
    @Min(0)
    amount: number;

    @IsEnum(ExpenseCategory)
    category: ExpenseCategory;

    @IsString()
    @MaxLength(500)
    description: string;

    @IsDateString()
    date: string;

    @IsOptional()
    @IsString() // URL validation could be added but might be too strict for internal paths
    receiptUrl?: string;

    @IsOptional()
    @IsEnum(ExpenseStatus)
    status?: ExpenseStatus;
}
