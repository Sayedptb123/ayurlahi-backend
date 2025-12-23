import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { ManufacturersModule } from './manufacturers/manufacturers.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { ClinicsModule } from './clinics/clinics.module';
import { InvoicesModule } from './invoices/invoices.module';
import { DisputesModule } from './disputes/disputes.module';
import { PayoutsModule } from './payouts/payouts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { StaffModule } from './staff/staff.module';
import { PatientsModule } from './patients/patients.module';
import { DoctorsModule } from './doctors/doctors.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { LabReportsModule } from './lab-reports/lab-reports.module';
import { PatientBillingModule } from './patient-billing/patient-billing.module';
import { User } from './users/entities/user.entity';
import { Product } from './products/entities/product.entity';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { Clinic } from './clinics/entities/clinic.entity';
import { Manufacturer } from './manufacturers/entities/manufacturer.entity';
import { Invoice } from './invoices/entities/invoice.entity';
import { Dispute } from './disputes/entities/dispute.entity';
import { Staff } from './staff/entities/staff.entity';
import { Patient } from './patients/entities/patient.entity';
import { Doctor } from './doctors/entities/doctor.entity';
import { Appointment } from './appointments/entities/appointment.entity';
import { MedicalRecord } from './medical-records/entities/medical-record.entity';
import { Prescription } from './prescriptions/entities/prescription.entity';
import { PrescriptionItem } from './prescriptions/entities/prescription-item.entity';
import { LabReport } from './lab-reports/entities/lab-report.entity';
import { LabTest } from './lab-reports/entities/lab-test.entity';
import { PatientBill } from './patient-billing/entities/patient-bill.entity';
import { BillItem } from './patient-billing/entities/bill-item.entity';
import { CustomNamingStrategy } from './common/naming-strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'ayurlahi'),
        entities: [User, Product, Order, OrderItem, Clinic, Manufacturer, Invoice, Dispute, Staff, Patient, Doctor, Appointment, MedicalRecord, Prescription, PrescriptionItem, LabReport, LabTest, PatientBill, BillItem],
        synchronize: false, // Disabled to prevent schema conflicts with existing data
        logging: configService.get<string>('NODE_ENV') === 'development',
        namingStrategy: new CustomNamingStrategy(),
      }),
      inject: [ConfigService],
    }),
    ProductsModule,
    ManufacturersModule,
    UsersModule,
    AuthModule,
    OrdersModule,
    ClinicsModule,
    InvoicesModule,
    DisputesModule,
    PayoutsModule,
    AnalyticsModule,
    StaffModule,
    PatientsModule,
    DoctorsModule,
    AppointmentsModule,
    MedicalRecordsModule,
    PrescriptionsModule,
    LabReportsModule,
    PatientBillingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
