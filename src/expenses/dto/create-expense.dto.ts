import {
    IsNumber,
    IsOptional,
    IsString,
    IsDateString,
    Min,
    Max,
    MaxLength,
} from 'class-validator';

export class CreateExpenseDto {
    @IsNumber()
    @Min(0)
    // DB column is DECIMAL(10,2): 99,999,999.99 max — validate at DTO so client
    // gets 400 instead of a 500 "numeric field overflow" from Postgres.
    @Max(99999999.99)
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
