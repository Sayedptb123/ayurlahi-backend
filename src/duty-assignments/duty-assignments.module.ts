import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DutyAssignmentsController } from './duty-assignments.controller';
import { DutyAssignmentsService } from './duty-assignments.service';
import { DutyAssignment } from './entities/duty-assignment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Staff } from '../staff/entities/staff.entity';
import { DutyType } from '../duty-types/entities/duty-type.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DutyAssignment,
      Branch,
      Staff,
      DutyType,
      OrganisationUser,
    ]),
  ],
  controllers: [DutyAssignmentsController],
  providers: [DutyAssignmentsService],
  exports: [DutyAssignmentsService],
})
export class DutyAssignmentsModule {}


