import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabReportsController } from './lab-reports.controller';
import { LabReportsService } from './lab-reports.service';
import { LabReport } from './entities/lab-report.entity';
import { LabTest } from './entities/lab-test.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Appointment } from '../appointments/entities/appointment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LabReport, LabTest, Patient, Staff, Appointment]),
  ],
  controllers: [LabReportsController],
  providers: [LabReportsService],
  exports: [LabReportsService],
})
export class LabReportsModule {}
