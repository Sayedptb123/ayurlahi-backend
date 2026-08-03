import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { Appointment } from './entities/appointment.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Staff } from '../staff/entities/staff.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, User, Patient, Staff]),
    NotificationsModule,
    BranchVisibilityModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
