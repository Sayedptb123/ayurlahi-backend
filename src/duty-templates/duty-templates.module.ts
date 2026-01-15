import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DutyTemplatesController } from './duty-templates.controller';
import { DutyTemplatesService } from './duty-templates.service';
import { DutyTemplate } from './entities/duty-template.entity';
import { Branch } from '../branches/entities/branch.entity';
import { DutyAssignmentsModule } from '../duty-assignments/duty-assignments.module';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DutyTemplate, Branch, OrganisationUser]),
    DutyAssignmentsModule,
  ],
  controllers: [DutyTemplatesController],
  providers: [DutyTemplatesService],
  exports: [DutyTemplatesService],
})
export class DutyTemplatesModule {}


