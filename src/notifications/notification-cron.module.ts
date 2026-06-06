import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { DutyAssignment } from '../duty-assignments/entities/duty-assignment.entity';
import { StaffTask } from '../tasks/entities/staff-task.entity';
import { PatientBill } from '../patient-billing/entities/patient-bill.entity';
import { Staff } from '../staff/entities/staff.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { NotificationsModule } from './notifications.module';
import { NotificationCronService } from './notification-cron.service';
import { CrmTask } from '../crm/entities/crm-task.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Appointment,
            DutyAssignment,
            StaffTask,
            PatientBill,
            Staff,
            OrganisationUser,
            InventoryItem,
            CrmTask,
        ]),
        NotificationsModule,
    ],
    providers: [NotificationCronService],
})
export class NotificationCronModule {}
