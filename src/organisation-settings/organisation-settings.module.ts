import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationSettings } from './entities/organisation-settings.entity';
import { OrganisationSettingsService } from './organisation-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrganisationSettings])],
  providers: [OrganisationSettingsService],
  exports: [OrganisationSettingsService],
})
export class OrganisationSettingsModule {}
