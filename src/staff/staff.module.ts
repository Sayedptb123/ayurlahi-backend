import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { Staff } from './entities/staff.entity';
import { ClinicsModule } from '../clinics/clinics.module';
import { ManufacturersModule } from '../manufacturers/manufacturers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Staff]),
    ClinicsModule,
    ManufacturersModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}


