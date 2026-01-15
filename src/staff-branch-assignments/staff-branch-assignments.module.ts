import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffBranchAssignmentsController } from './staff-branch-assignments.controller';
import { StaffBranchAssignmentsService } from './staff-branch-assignments.service';
import { StaffBranchAssignment } from './entities/staff-branch-assignment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Staff } from '../staff/entities/staff.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffBranchAssignment,
      Branch,
      Staff,
      OrganisationUser,
    ]),
  ],
  controllers: [StaffBranchAssignmentsController],
  providers: [StaffBranchAssignmentsService],
  exports: [StaffBranchAssignmentsService],
})
export class StaffBranchAssignmentsModule {}


