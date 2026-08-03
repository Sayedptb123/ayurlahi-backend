import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';

import { Organisation } from '../organisations/entities/organisation.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { OrganisationSettingsModule } from '../organisation-settings/organisation-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organisation, OrganisationUser]),
    OrganisationSettingsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
