import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController, StaffPublicController } from './staff.controller';
import { StaffService } from './staff.service';
import { Staff } from './entities/staff.entity';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, User, OrganisationUser]), NotificationsModule],
  controllers: [StaffController, StaffPublicController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule { }
