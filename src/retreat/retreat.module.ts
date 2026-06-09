import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetreatService } from './retreat.service';
import { RetreatController } from './retreat.controller';
import { Room } from './entities/room.entity';
import { TreatmentPackage } from './entities/treatment-package.entity';
import { Admission } from './entities/admission.entity';
import { RoomBooking } from './entities/room-booking.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, TreatmentPackage, Admission, RoomBooking, OrganisationUser, Patient]),
    NotificationsModule,
  ],
  controllers: [RetreatController],
  providers: [RetreatService],
})
export class RetreatModule { }
