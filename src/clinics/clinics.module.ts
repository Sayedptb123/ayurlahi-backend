import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { Organisation } from '../organisations/entities/organisation.entity';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Organisation, User, OrganisationUser])],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule { }
