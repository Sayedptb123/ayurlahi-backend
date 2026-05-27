import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';
import { Organisation } from './entities/organisation.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organisation, OrganisationUser]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [OrganisationsController],
  providers: [OrganisationsService],
  exports: [OrganisationsService],
})
export class OrganisationsModule { }


