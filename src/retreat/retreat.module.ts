import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetreatService } from './retreat.service';
import { RetreatController } from './retreat.controller';
import { Room } from './entities/room.entity';
import { TreatmentPackage } from './entities/treatment-package.entity';
import { Admission } from './entities/admission.entity';
import { RoomBooking } from './entities/room-booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, TreatmentPackage, Admission, RoomBooking])],
  controllers: [RetreatController],
  providers: [RetreatService],
})
export class RetreatModule { }
