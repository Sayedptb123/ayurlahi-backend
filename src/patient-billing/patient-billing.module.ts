import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientBillingController } from './patient-billing.controller';
import { PatientBillingService } from './patient-billing.service';
import { PatientBill } from './entities/patient-bill.entity';
import { BillItem } from './entities/bill-item.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientBill,
      BillItem,
      User,
      Patient,
      Appointment,
    ]),
  ],
  controllers: [PatientBillingController],
  providers: [PatientBillingService],
  exports: [PatientBillingService],
})
export class PatientBillingModule {}
