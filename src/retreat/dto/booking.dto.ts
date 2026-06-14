import { IsUUID, IsDateString, IsOptional, IsNumber, IsString, IsEnum, Min, ValidateIf } from 'class-validator';
import { BookingStatus } from '../entities/room-booking.entity';

export class CreateBookingDto {
    @IsOptional()
    @IsUUID()
    patientId?: string;

    @IsOptional()
    @IsUUID()
    enquiryId?: string;

    @IsUUID()
    roomId: string;

    @IsOptional()
    @IsUUID()
    packageId?: string;

    @IsDateString()
    checkInDate: string;

    @IsDateString()
    checkOutDate: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    totalPrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    advancePaid?: number;

    @IsOptional()
    @IsString()
    discountReason?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateBookingDto {
    @IsOptional()
    @IsUUID()
    roomId?: string;

    @IsOptional()
    @IsUUID()
    packageId?: string;

    @IsOptional()
    @IsDateString()
    checkInDate?: string;

    @IsOptional()
    @IsDateString()
    checkOutDate?: string;

    @IsOptional()
    @IsEnum(BookingStatus)
    status?: BookingStatus;

    @IsOptional()
    @IsNumber()
    @Min(0)
    totalPrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    advancePaid?: number;

    @IsOptional()
    @IsString()
    discountReason?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class CheckAvailabilityDto {
    @IsUUID()
    roomId: string;

    @IsDateString()
    checkInDate: string;

    @IsDateString()
    checkOutDate: string;

    @IsOptional()
    @IsUUID()
    excludeBookingId?: string;
}
