import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetreatService } from './retreat.service';
import { RetreatController } from './retreat.controller';
import { Room } from './entities/room.entity';
import { RoomCategory } from './entities/room-category.entity';
import { RoomCategoryPricing } from './entities/room-category-pricing.entity';
import { RoomPricingOverride } from './entities/room-pricing-override.entity';
import { TreatmentPackage } from './entities/treatment-package.entity';
import { Admission } from './entities/admission.entity';
import { RoomBooking } from './entities/room-booking.entity';
import { BookingEnquiry } from './entities/booking-enquiry.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { ClinicCapabilities } from '../clinic-capabilities/entities/clinic-capabilities.entity';
import { BookingFieldDefinition } from './entities/booking-field-definition.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientBillingModule } from '../patient-billing/patient-billing.module';
import { PatientsModule } from '../patients/patients.module';
import { ModuleGuard } from '../auth/guards/module.guard';
import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomCategory, RoomCategoryPricing, RoomPricingOverride, TreatmentPackage, Admission, RoomBooking, BookingEnquiry, OrganisationUser, Patient, ClinicCapabilities, BookingFieldDefinition]),
    NotificationsModule,
    PatientBillingModule,
    PatientsModule,
    BranchVisibilityModule,
  ],
  controllers: [RetreatController],
  providers: [RetreatService, ModuleGuard],
})
export class RetreatModule { }
