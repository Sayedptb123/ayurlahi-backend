import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManufacturersController } from './manufacturers.controller';
import { ManufacturersService } from './manufacturers.service';
import { Organisation } from '../organisations/entities/organisation.entity';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Organisation, User, OrganisationUser])],
  controllers: [ManufacturersController],
  providers: [ManufacturersService],
  exports: [ManufacturersService],
})
export class ManufacturersModule { }
