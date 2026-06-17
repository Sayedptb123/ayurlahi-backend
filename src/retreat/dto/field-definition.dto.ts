import {
    IsString, IsOptional, IsBoolean, IsNumber, IsIn, IsArray, Min, MaxLength,
    Matches,
} from 'class-validator';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'textarea'] as const;

export class CreateFieldDefinitionDto {
    @IsString()
    @MaxLength(100)
    label: string;

    @IsString()
    @MaxLength(50)
    @Matches(/^[a-z][a-z0-9_]*$/, { message: 'field_key must be snake_case (lowercase letters, digits, underscores; must start with a letter)' })
    fieldKey: string;

    @IsIn(FIELD_TYPES)
    fieldType: typeof FIELD_TYPES[number];

    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    options?: string[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    displayOrder?: number;
}

export class UpdateFieldDefinitionDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    label?: string;

    @IsOptional()
    @IsIn(FIELD_TYPES)
    fieldType?: typeof FIELD_TYPES[number];

    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    options?: string[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    displayOrder?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
