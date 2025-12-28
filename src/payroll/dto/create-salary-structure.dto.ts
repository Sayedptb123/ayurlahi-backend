import {
    IsNumber,
    IsOptional,
    IsUUID,
    IsArray,
    ValidateNested,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class AllowanceDto {
    @IsNumber()
    amount: number;

    name: string;
}

class DeductionDto {
    @IsNumber()
    amount: number;

    name: string;
}

export class CreateSalaryStructureDto {
    @IsUUID()
    staffId: string;

    @IsNumber()
    @Min(0)
    baseSalary: number;

    @IsNumber()
    @Min(0)
    hra: number;

    @IsNumber()
    @Min(0)
    da: number;

    @IsNumber()
    @Min(0)
    medicalAllowance: number;

    @IsNumber()
    @Min(0)
    travelAllowance: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AllowanceDto)
    otherAllowances?: AllowanceDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DeductionDto)
    deductions?: DeductionDto[];
}
