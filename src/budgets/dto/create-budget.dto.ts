import {
    IsEnum,
    IsNumber,
    IsBoolean,
    IsDateString,
    Min,
    IsOptional,
} from 'class-validator';
import { ExpenseCategory } from '../../expenses/entities/expense.entity';

export class CreateBudgetDto {
    @IsEnum(ExpenseCategory)
    category: ExpenseCategory;

    @IsNumber()
    @Min(0)
    amount: number;

    @IsDateString()
    period: string;

    @IsOptional()
    @IsBoolean()
    alertsEnabled?: boolean;
}
