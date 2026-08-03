import { IsNotEmpty, IsOptional, IsNumber, IsUUID, Min } from 'class-validator';

export class SetRoomPricingOverrideDto {
    @IsNotEmpty()
    @IsUUID()
    roomId: string;

    @IsNotEmpty()
    @IsUUID()
    packageId: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    price: number;
}

export class GetRoomPricingOverridesDto {
    @IsOptional()
    @IsUUID()
    branchId?: string;
}
