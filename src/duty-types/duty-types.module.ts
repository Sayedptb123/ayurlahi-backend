import { Module } from '@nestjs/common';
import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DutyTypesController } from './duty-types.controller';
import { DutyTypesService } from './duty-types.service';
import { DutyType } from './entities/duty-type.entity';
import { Branch } from '../branches/entities/branch.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DutyType, Branch, OrganisationUser]),
    BranchVisibilityModule],
  controllers: [DutyTypesController],
  providers: [DutyTypesService],
  exports: [DutyTypesService],
})
export class DutyTypesModule {}


