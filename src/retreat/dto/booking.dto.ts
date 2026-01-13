import { IsUUID, IsDateString, IsOptional, IsNumber, IsString, IsEnum, Min } from 'class-validator';
import { BookingStatus } from '../entities/room-booking.entity';

export class CreateBookingDto {
    @IsUUID()
    patientId: string;

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
    advancePaid?: number;

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
    advancePaid?: number;

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
    excludeBookingId?: string; // For checking when updating existing booking
}
