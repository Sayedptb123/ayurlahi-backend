import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationUsersController } from './organisation-users.controller';
import { OrganisationUsersService } from './organisation-users.service';
import { OrganisationUser } from './entities/organisation-user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrganisationUser, Organisation, User])],
  controllers: [OrganisationUsersController],
  providers: [OrganisationUsersService],
  exports: [OrganisationUsersService, TypeOrmModule],
})
export class OrganisationUsersModule { }


