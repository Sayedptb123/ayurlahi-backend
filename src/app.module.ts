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
import { OrganisationsModule } from './organisations/organisations.module';
import { OrganisationUsersModule } from './organisation-users/organisation-users.module';
import { BranchesModule } from './branches/branches.module';
import { StaffBranchAssignmentsModule } from './staff-branch-assignments/staff-branch-assignments.module';
import { DutyTypesModule } from './duty-types/duty-types.module';
import { DutyAssignmentsModule } from './duty-assignments/duty-assignments.module';
import { DutyTemplatesModule } from './duty-templates/duty-templates.module';
import { DocumentsModule } from './documents/documents.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ExpensesModule } from './expenses/expenses.module';
import { BudgetsModule } from './budgets/budgets.module';
import { PayrollModule } from './payroll/payroll.module';
import { ManufacturingModule } from './manufacturing/manufacturing.module';
import { User } from './users/entities/user.entity';
import { Organisation } from './organisations/entities/organisation.entity';
import { OrganisationUser } from './organisation-users/entities/organisation-user.entity';
import { Branch } from './branches/entities/branch.entity';
import { StaffBranchAssignment } from './staff-branch-assignments/entities/staff-branch-assignment.entity';
import { DutyType } from './duty-types/entities/duty-type.entity';
import { DutyAssignment } from './duty-assignments/entities/duty-assignment.entity';
import { DutyTemplate } from './duty-templates/entities/duty-template.entity';
import { Document } from './documents/entities/document.entity';
import { Supplier } from './suppliers/entities/supplier.entity';
import { InventoryItem } from './inventory/entities/inventory-item.entity';
import { PurchaseOrder } from './purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from './purchase-orders/entities/purchase-order-item.entity';
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
import { RawMaterial } from './manufacturing/entities/raw-material.entity';
import { InventoryTransaction } from './manufacturing/entities/inventory-transaction.entity';
import { ManufacturingFormula } from './manufacturing/entities/manufacturing-formula.entity';
import { FormulaItem } from './manufacturing/entities/formula-item.entity';
import { ProcessStage } from './manufacturing/entities/process-stage.entity';
import { Equipment } from './manufacturing/entities/equipment.entity';
import { Batch } from './manufacturing/entities/batch.entity';
import { BatchStage } from './manufacturing/entities/batch-stage.entity';
import { WastageLog } from './manufacturing/entities/wastage-log.entity';
import { CustomNamingStrategy } from './common/naming-strategy';
import { RetreatModule } from './retreat/retreat.module';
import { Room } from './retreat/entities/room.entity';
import { TreatmentPackage } from './retreat/entities/treatment-package.entity';
import { Admission } from './retreat/entities/admission.entity';

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
        entities: [
          User,
          Organisation,
          OrganisationUser,
          Branch,
          StaffBranchAssignment,
          DutyType,
          DutyAssignment,
          DutyTemplate,
          Document,
          Supplier,
          InventoryItem,
          PurchaseOrder,
          PurchaseOrderItem,
          Product,
          Order,
          OrderItem,
          Clinic,
          Manufacturer,
          Invoice,
          Dispute,
          Staff,
          Patient,
          Doctor,
          Appointment,
          MedicalRecord,
          Prescription,
          PrescriptionItem,
          LabReport,
          LabTest,
          PatientBill,
          BillItem,
          RawMaterial,
          InventoryTransaction,
          ManufacturingFormula,
          FormulaItem,
          ProcessStage,
          Equipment,
          Batch,
          BatchStage,
          WastageLog,
          Room,
          TreatmentPackage,
          Admission,
        ],
        synchronize: false, // Disabled - synchronize causes issues
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
    OrganisationsModule,
    OrganisationUsersModule,
    BranchesModule,
    StaffBranchAssignmentsModule,
    DutyTypesModule,
    DutyAssignmentsModule,
    DutyTemplatesModule,
    DocumentsModule,
    SuppliersModule,
    InventoryModule,
    PurchaseOrdersModule,
    ExpensesModule,
    BudgetsModule,
    PayrollModule,
    ManufacturingModule,
    RetreatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
