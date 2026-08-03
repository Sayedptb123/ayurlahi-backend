import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID, IsArray, MaxLength, Min } from 'class-validator';

export class CreatePackageDto {
    // ADR-004 D15 — branch-owned setup catalog, required on create.
    @IsNotEmpty()
    @IsUUID()
    branchId: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    durationDays?: number;

    @IsOptional()
    @IsArray()
    inclusions?: string[];

    @IsOptional()
    @IsString()
    @MaxLength(500)
    imageUrl?: string;
}

export class UpdatePackageDto {
    // Optional — this is also how a legacy NULL-branch row gets resolved,
    // via the normal edit form. See ADR-004 D15.
    @IsOptional()
    @IsUUID()
    branchId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    durationDays?: number;

    @IsOptional()
    @IsArray()
    inclusions?: string[];

    @IsOptional()
    @IsString()
    @MaxLength(500)
    imageUrl?: string;
}

export class GetPackagesDto {
    @IsOptional()
    @IsUUID()
    branchId?: string;
}
