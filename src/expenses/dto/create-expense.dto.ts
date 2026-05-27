import {
    IsNumber,
    IsOptional,
    IsString,
    IsDateString,
    Min,
    MaxLength,
} from 'class-validator';

export class CreateExpenseDto {
    @IsNumber()
    @Min(0)
    amount: number;

    @IsString()
    category: string;

    @IsString()
    @MaxLength(500)
    description: string;

    @IsDateString()
    date: string;

    @IsOptional()
    @IsString()
    receiptUrl?: string;

    @IsOptional()
    @IsString()
    status?: string;
}
