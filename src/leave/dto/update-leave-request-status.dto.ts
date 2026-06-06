import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveStatus } from '../entities/leave-request.entity';

export class UpdateLeaveRequestStatusDto {
  @ApiProperty({ description: 'New status of the leave request', enum: [LeaveStatus.APPROVED, LeaveStatus.REJECTED, LeaveStatus.CANCELLED] })
  @IsEnum([LeaveStatus.APPROVED, LeaveStatus.REJECTED, LeaveStatus.CANCELLED])
  @IsNotEmpty()
  status: LeaveStatus;

  @ApiProperty({ description: 'Reason for rejection (mandatory or optional depending on flow)', required: false })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
