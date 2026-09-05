import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesController } from './branches.controller';
import { BranchesAdminController } from './branches-admin.controller';
import { BranchesService } from './branches.service';
import { Branch } from './entities/branch.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganisationSettingsModule } from '../organisation-settings/organisation-settings.module';
import { StaffBranchAssignmentsModule } from '../staff-branch-assignments/staff-branch-assignments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, OrganisationUser]),
    NotificationsModule,
    OrganisationSettingsModule,
    StaffBranchAssignmentsModule,
  ],
  controllers: [BranchesController, BranchesAdminController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}


