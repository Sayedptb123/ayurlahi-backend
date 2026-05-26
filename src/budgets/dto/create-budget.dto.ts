import {
    IsString,
    IsNumber,
    IsDateString,
    Min,
    IsOptional,
    MaxLength,
} from 'class-validator';

export class CreateBudgetDto {
    @IsString()
    @MaxLength(255)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNumber()
    @Min(0)
    totalAmount: number;

    @IsDateString()
    periodStart: string;

    @IsDateString()
    periodEnd: string;

    @IsOptional()
    @IsString()
    status?: string;
}
