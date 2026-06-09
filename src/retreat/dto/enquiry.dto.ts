import { IsString, IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { EnquiryChannel, EnquiryStatus } from '../entities/booking-enquiry.entity';

export class CreateEnquiryDto {
    @IsString()
    contactName: string;

    @IsString()
    phone: string;

    @IsEnum(EnquiryChannel)
    channel: EnquiryChannel;

    @IsOptional()
    @IsString()
    preferredRoomType?: string;

    @IsOptional()
    @IsDateString()
    preferredCheckIn?: string;

    @IsOptional()
    @IsDateString()
    preferredCheckOut?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsUUID()
    assignedTo?: string;

    @IsOptional()
    @IsDateString()
    followUpAt?: string;
}

export class UpdateEnquiryDto {
    @IsOptional()
    @IsString()
    contactName?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEnum(EnquiryChannel)
    channel?: EnquiryChannel;

    @IsOptional()
    @IsString()
    preferredRoomType?: string;

    @IsOptional()
    @IsDateString()
    preferredCheckIn?: string;

    @IsOptional()
    @IsDateString()
    preferredCheckOut?: string;

    @IsOptional()
    @IsEnum(EnquiryStatus)
    status?: EnquiryStatus;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsUUID()
    assignedTo?: string;

    @IsOptional()
    @IsDateString()
    followUpAt?: string;

    @IsOptional()
    @IsString()
    lostReason?: string;
}

export class ConvertEnquiryDto {
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
    @IsString()
    notes?: string;
}
