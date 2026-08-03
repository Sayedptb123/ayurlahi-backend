import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientBillingController } from './patient-billing.controller';
import { PatientBillingService } from './patient-billing.service';
import { PatientBill } from './entities/patient-bill.entity';
import { BillItem } from './entities/bill-item.entity';
import { PatientBillPayment } from './entities/patient-bill-payment.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { RoomBooking } from '../retreat/entities/room-booking.entity';
import { Admission } from '../retreat/entities/admission.entity';
import { Branch } from '../branches/entities/branch.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatientBill, BillItem, PatientBillPayment, Patient, Appointment, OrganisationUser, RoomBooking, Admission, Branch]),
    NotificationsModule,
    BranchVisibilityModule,
  ],
  controllers: [PatientBillingController],
  providers: [PatientBillingService],
  exports: [PatientBillingService],
})
export class PatientBillingModule {}
