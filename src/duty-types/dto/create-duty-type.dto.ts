import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateDutyTypeDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: 'startTime must be in HH:MM:SS format',
  })
  startTime: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: 'endTime must be in HH:MM:SS format',
  })
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color code',
  })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

