import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
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
import { FileUploadModule } from './file-upload/file-upload.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailModule } from './email/email.module';
import { ScraperModule } from './scraper/scraper.module';
import { PushToken } from './notifications/entities/push-token.entity';
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
import { StockMovement } from './inventory/entities/stock-movement.entity';
import { TreatmentProtocol } from './treatment-protocols/entities/treatment-protocol.entity';
import { TreatmentProtocolItem } from './treatment-protocols/entities/treatment-protocol-item.entity';
import { TreatmentProtocolsModule } from './treatment-protocols/treatment-protocols.module';
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
import { Expense } from './expenses/entities/expense.entity';
import { Budget } from './budgets/entities/budget.entity';
import { PayrollRecord } from './payroll/entities/payroll-record.entity';
import { SalaryStructure } from './payroll/entities/salary-structure.entity';
import { CustomNamingStrategy } from './common/naming-strategy';
import { RetreatModule } from './retreat/retreat.module';
import { Room } from './retreat/entities/room.entity';
import { TreatmentPackage } from './retreat/entities/treatment-package.entity';
import { Admission } from './retreat/entities/admission.entity';
import { RoomBooking } from './retreat/entities/room-booking.entity';
import { BookingEnquiry } from './retreat/entities/booking-enquiry.entity';
import { VitalsModule } from './vitals/vitals.module';
import { Vital } from './vitals/entities/vital.entity';
import { FeedingLogsModule } from './feeding-logs/feeding-logs.module';
import { FeedingLog } from './feeding-logs/entities/feeding-log.entity';
import { NewbornAssessmentsModule } from './newborn-assessments/newborn-assessments.module';
import { NewbornAssessment } from './newborn-assessments/entities/newborn-assessment.entity';
import { ClinicCapabilities } from './clinic-capabilities/entities/clinic-capabilities.entity';
import { ClinicProfile } from './organisations/entities/clinic-profile.entity';
import { ManufacturerProfile } from './organisations/entities/manufacturer-profile.entity';
import { OrganisationContact } from './organisations/entities/organisation-contact.entity';
import { TasksModule } from './tasks/tasks.module';
import { StaffTask } from './tasks/entities/staff-task.entity';
import { UserNotification } from './notifications/entities/user-notification.entity';
import { CustomNotificationLog } from './notifications/entities/custom-notification-log.entity';
import { NotificationCronModule } from './notifications/notification-cron.module';
import { Payout } from './payouts/entities/payout.entity';
import { OtpVerification } from './otp/entities/otp-verification.entity';
import { CrmModule } from './crm/crm.module';
import { CrmLead } from './crm/entities/crm-lead.entity';
import { CrmPipelineStage } from './crm/entities/crm-pipeline-stage.entity';
import { CrmActivity } from './crm/entities/crm-activity.entity';
import { CrmRequirement } from './crm/entities/crm-requirement.entity';
import { CrmTask } from './crm/entities/crm-task.entity';
import { CrmVisit } from './crm/entities/crm-visit.entity';
import { CrmAuditLog } from './crm/entities/crm-audit-log.entity';
import { CrmStaffScope } from './crm/entities/crm-staff-scope.entity';
import { PromotionsModule } from './promotions/promotions.module';
import { Promotion } from './promotions/entities/promotion.entity';
import { PromotionEvent } from './promotions/entities/promotion-event.entity';
import { UsageEvent } from './analytics/entities/usage-event.entity';
import { LeaveModule } from './leave/leave.module';
import { LeaveType } from './leave/entities/leave-type.entity';
import { LeaveRequest } from './leave/entities/leave-request.entity';
import { LeaveBalance } from './leave/entities/leave-balance.entity';
import { AssetModule } from './assets/assets.module';
import { AssetCategory } from './assets/entities/asset-category.entity';
import { Asset } from './assets/entities/asset.entity';
import { AssetMaintenance } from './assets/entities/asset-maintenance.entity';
import { BillsModule } from './bills/bills.module';
import { RecurringBill } from './bills/entities/recurring-bill.entity';
import { BillPayment } from './bills/entities/bill-payment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },   // 10 req/sec burst
      { name: 'medium', ttl: 60000, limit: 200 }, // 200 req/min sustained
    ]),
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
          StockMovement,
          TreatmentProtocol,
          TreatmentProtocolItem,
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
          RoomBooking,
          BookingEnquiry,
          Vital,
          FeedingLog,
          NewbornAssessment,
          StaffTask,
          PushToken,
          UserNotification,
          CustomNotificationLog,
          ClinicCapabilities,
          ClinicProfile,
          ManufacturerProfile,
          OrganisationContact,
          Expense,
          Budget,
          PayrollRecord,
          SalaryStructure,
          Payout,
          OtpVerification,
          CrmLead,
          CrmPipelineStage,
          CrmActivity,
          CrmRequirement,
          CrmTask,
          CrmVisit,
          CrmAuditLog,
          CrmStaffScope,
          Promotion,
          PromotionEvent,
          UsageEvent,
          LeaveType,
          LeaveRequest,
          LeaveBalance,
          AssetCategory,
          Asset,
          AssetMaintenance,
          RecurringBill,
          BillPayment,
        ],
        synchronize: false, // Disabled - synchronize causes issues
        logging: configService.get<string>('NODE_ENV') === 'development',
        namingStrategy: new CustomNamingStrategy(),
        // SSL is required by managed Postgres providers (Supabase, RDS, etc.).
        // Toggle via DB_SSL env var so localhost can still connect without it.
        // `rejectUnauthorized: false` is intentional — Supabase uses a self-signed
        // cert chain that Node can't verify out of the box.
        ssl: configService.get<string>('DB_SSL') === 'true'
          ? { rejectUnauthorized: false }
          : false,
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
    TreatmentProtocolsModule,
    ExpensesModule,
    BudgetsModule,
    PayrollModule,
    ManufacturingModule,
    RetreatModule,
    VitalsModule,
    FeedingLogsModule,
    NewbornAssessmentsModule,
    TasksModule,
    FileUploadModule,
    NotificationsModule,
    NotificationCronModule,
    EmailModule,
    ScraperModule,
    CrmModule,
    PromotionsModule,
    LeaveModule,
    AssetModule,
    BillsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // global rate limiting
  ],
})
export class AppModule { }
