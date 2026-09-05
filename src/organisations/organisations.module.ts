import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';
import { Organisation } from './entities/organisation.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { ClinicCapabilities } from '../clinic-capabilities/entities/clinic-capabilities.entity';
import { ClinicProfile } from './entities/clinic-profile.entity';
import { ManufacturerProfile } from './entities/manufacturer-profile.entity';
import { OrganisationContact } from './entities/organisation-contact.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Branch } from '../branches/entities/branch.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganisationSettingsModule } from '../organisation-settings/organisation-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organisation,
      OrganisationUser,
      ClinicCapabilities,
      ClinicProfile,
      ManufacturerProfile,
      OrganisationContact,
      Staff,
      Branch,
    ]),
    UsersModule,
    NotificationsModule,
    OrganisationSettingsModule,
  ],
  controllers: [OrganisationsController],
  providers: [OrganisationsService],
  exports: [OrganisationsService],
})
export class OrganisationsModule { }


