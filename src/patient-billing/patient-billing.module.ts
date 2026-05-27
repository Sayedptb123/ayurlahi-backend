import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientBillingController } from './patient-billing.controller';
import { PatientBillingService } from './patient-billing.service';
import { PatientBill } from './entities/patient-bill.entity';
import { BillItem } from './entities/bill-item.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatientBill, BillItem, Patient, Appointment, OrganisationUser]),
    NotificationsModule,
  ],
  controllers: [PatientBillingController],
  providers: [PatientBillingService],
  exports: [PatientBillingService],
})
export class PatientBillingModule {}
