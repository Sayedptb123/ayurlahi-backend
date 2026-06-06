import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { Staff } from '../staff/entities/staff.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveType, LeaveRequest, LeaveBalance, Staff]),
  ],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
