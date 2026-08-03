import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, MaxLength } from 'class-validator';

export class CreateRoomCategoryDto {
    // ADR-004 D15 — branch-owned setup catalog, required on create.
    @IsNotEmpty()
    @IsUUID()
    branchId: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    name: string;
}

export class UpdateRoomCategoryDto {
    // Optional — this is also how a legacy NULL-branch row gets resolved,
    // via the normal edit form. See ADR-004 D15.
    @IsOptional()
    @IsUUID()
    branchId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class GetRoomCategoriesDto {
    @IsOptional()
    @IsUUID()
    branchId?: string;
}
