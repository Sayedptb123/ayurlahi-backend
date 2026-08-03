import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Staff } from '../staff/entities/staff.entity';
import { StaffBranchAssignment } from '../staff-branch-assignments/entities/staff-branch-assignment.entity';
import { BranchVisibilityService } from './branch-visibility.service';
import { OrganisationSettingsModule } from '../organisation-settings/organisation-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Staff, StaffBranchAssignment]),
    OrganisationSettingsModule,
  ],
  providers: [BranchVisibilityService],
  exports: [BranchVisibilityService],
})
export class BranchVisibilityModule {}
