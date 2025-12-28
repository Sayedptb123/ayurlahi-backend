import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DutyTypesController } from './duty-types.controller';
import { DutyTypesService } from './duty-types.service';
import { DutyType } from './entities/duty-type.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DutyType, OrganisationUser])],
  controllers: [DutyTypesController],
  providers: [DutyTypesService],
  exports: [DutyTypesService],
})
export class DutyTypesModule {}

