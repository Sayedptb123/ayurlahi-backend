import { IsNotEmpty, IsOptional, IsNumber, IsUUID, Min } from 'class-validator';

export class SetPricingMatrixDto {
    @IsNotEmpty()
    @IsUUID()
    roomCategoryId: string;

    @IsNotEmpty()
    @IsUUID()
    packageId: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    basePrice: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    acSupplementPerDay?: number | null;
}

export class GetPricingMatrixDto {
    @IsOptional()
    @IsUUID()
    branchId?: string;
}
