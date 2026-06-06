import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { DutyAssignment } from '../duty-assignments/entities/duty-assignment.entity';
import { StaffTask } from '../tasks/entities/staff-task.entity';
import { PatientBill, BillStatus } from '../patient-billing/entities/patient-bill.entity';
import { Staff } from '../staff/entities/staff.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { CrmTask } from '../crm/entities/crm-task.entity';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationCronService {
    constructor(
        @InjectRepository(Appointment)
        private appointmentRepo: Repository<Appointment>,
        @InjectRepository(DutyAssignment)
        private dutyRepo: Repository<DutyAssignment>,
        @InjectRepository(StaffTask)
        private taskRepo: Repository<StaffTask>,
        @InjectRepository(PatientBill)
        private billRepo: Repository<PatientBill>,
        @InjectRepository(Staff)
        private staffRepo: Repository<Staff>,
        @InjectRepository(OrganisationUser)
        private orgUserRepo: Repository<OrganisationUser>,
        @InjectRepository(InventoryItem)
        private inventoryRepo: Repository<InventoryItem>,
        @InjectRepository(CrmTask)
        private crmTaskRepo: Repository<CrmTask>,
        private notificationsService: NotificationsService,
    ) {}

    // --- Appointment reminders ---

    // 24h before: runs every hour at :00
    @Cron(CronExpression.EVERY_HOUR)
    async sendAppointmentReminders24h() {
        const now = new Date();
        const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

        const appointments = await this.appointmentRepo
            .createQueryBuilder('a')
            .where('a.status = :status', { status: AppointmentStatus.SCHEDULED })
            .andWhere('a.deleted_at IS NULL')
            .andWhere(
                `(a.appointment_date::text || ' ' || a.appointment_time)::timestamp BETWEEN :start AND :end`,
                { start: windowStart.toISOString(), end: windowEnd.toISOString() },
            )
            .getMany();

        for (const appt of appointments) {
            const staff = await this.staffRepo.findOne({ where: { id: appt.doctorId } });
            if (staff?.userId) {
                this.notificationsService.sendToUsers({
                    userIds: [staff.userId],
                    title: 'Appointment Tomorrow',
                    body: `Reminder: appointment scheduled for ${appt.appointmentDate} at ${appt.appointmentTime}`,
                    data: { appointmentId: appt.id, type: 'appointment_reminder_24h' },
                }).catch(() => {});
            }
        }
    }

    // 1h before: runs every 15 minutes
    @Cron('*/15 * * * *')
    async sendAppointmentReminders1h() {
        const now = new Date();
        const windowStart = new Date(now.getTime() + 45 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 75 * 60 * 1000);

        const appointments = await this.appointmentRepo
            .createQueryBuilder('a')
            .where('a.status = :status', { status: AppointmentStatus.SCHEDULED })
            .andWhere('a.deleted_at IS NULL')
            .andWhere(
                `(a.appointment_date::text || ' ' || a.appointment_time)::timestamp BETWEEN :start AND :end`,
                { start: windowStart.toISOString(), end: windowEnd.toISOString() },
            )
            .getMany();

        for (const appt of appointments) {
            const staff = await this.staffRepo.findOne({ where: { id: appt.doctorId } });
            if (staff?.userId) {
                this.notificationsService.sendToUsers({
                    userIds: [staff.userId],
                    title: 'Appointment in 1 Hour',
                    body: `Your appointment is at ${appt.appointmentTime} today`,
                    data: { appointmentId: appt.id, type: 'appointment_reminder_1h' },
                }).catch(() => {});
            }
        }
    }

    // --- Duty reminders ---

    // 30 min before shift: runs every 15 minutes
    @Cron('*/15 * * * *')
    async sendDutyReminders() {
        const now = new Date();
        const windowStart = new Date(now.getTime() + 15 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 45 * 60 * 1000);

        const duties = await this.dutyRepo
            .createQueryBuilder('d')
            .where('d.status = :status', { status: 'scheduled' })
            .andWhere('d.deleted_at IS NULL')
            .andWhere(
                `(d.duty_date::text || ' ' || d.start_time)::timestamp BETWEEN :start AND :end`,
                { start: windowStart.toISOString(), end: windowEnd.toISOString() },
            )
            .getMany();

        for (const duty of duties) {
            const staff = await this.staffRepo.findOne({ where: { id: duty.staffId } });
            if (staff?.userId) {
                this.notificationsService.sendToUsers({
                    userIds: [staff.userId],
                    title: 'Shift Starting Soon',
                    body: `Your shift starts at ${duty.startTime} today`,
                    data: { dutyId: duty.id, type: 'duty_reminder' },
                }).catch(() => {});
            }
        }
    }

    // No check-in alert — runs every 30 minutes
    @Cron('*/30 * * * *')
    async alertMissingCheckIns() {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

        const duties = await this.dutyRepo
            .createQueryBuilder('d')
            .where('d.status = :status', { status: 'scheduled' })
            .andWhere('d.deleted_at IS NULL')
            .andWhere('d.checked_in_at IS NULL')
            .andWhere(
                `(d.duty_date::text || ' ' || d.start_time)::timestamp BETWEEN :start AND :now`,
                { start: thirtyMinutesAgo.toISOString(), now: now.toISOString() },
            )
            .getMany();

        for (const duty of duties) {
            // Notify org MANAGER+OWNER
            const orgUsers = await this.orgUserRepo.find({
                where: { organisationId: duty.organisationId, role: In(['OWNER', 'MANAGER']), isActive: true },
            });
            const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
            if (userIds.length > 0) {
                const staff = await this.staffRepo.findOne({ where: { id: duty.staffId } });
                const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'A staff member';
                this.notificationsService.sendToUsers({
                    userIds,
                    title: 'Staff Not Checked In',
                    body: `${staffName} has not checked in for their shift that started at ${duty.startTime}`,
                    data: { dutyId: duty.id, type: 'duty_no_checkin' },
                }).catch(() => {});
            }
        }
    }

    // --- Task overdue — runs daily at 08:00 ---
    @Cron('0 8 * * *')
    async alertOverdueTasks() {
        const today = new Date().toISOString().split('T')[0];

        const tasks = await this.taskRepo
            .createQueryBuilder('t')
            .where('t.status NOT IN (:...doneStatuses)', { doneStatuses: ['completed', 'cancelled'] })
            .andWhere('t.due_date < :today', { today })
            .andWhere('t.deleted_at IS NULL')
            .getMany();

        for (const task of tasks) {
            const userIds: string[] = [];
            if (task.assignedToUserId) userIds.push(task.assignedToUserId);

            // Also notify staff via their linked user account
            const staffIds = [task.assignedToStaffId, task.assignedToNewStaffId].filter(Boolean) as string[];
            if (staffIds.length > 0) {
                const staffList = await this.staffRepo.find({ where: { id: In(staffIds) } });
                staffList.forEach((s) => { if (s.userId) userIds.push(s.userId); });
            }

            const uniqueUserIds = [...new Set(userIds)];
            if (uniqueUserIds.length > 0) {
                this.notificationsService.sendToUsers({
                    userIds: uniqueUserIds,
                    title: 'Task Overdue',
                    body: `Task "${task.title}" was due on ${task.dueDate} and is still open`,
                    data: { taskId: task.id, type: 'task_overdue' },
                }).catch(() => {});
            }
        }
    }

    // --- Bill overdue + due in 3 days — runs daily at 09:00 ---
    @Cron('0 9 * * *')
    async alertOverdueBills() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const in3days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Overdue bills
        const overdueBills = await this.billRepo
            .createQueryBuilder('b')
            .where('b.status NOT IN (:...paidStatuses)', { paidStatuses: [BillStatus.PAID, BillStatus.CANCELLED] })
            .andWhere('b.due_date < :today', { today: todayStr })
            .andWhere('b.due_date IS NOT NULL')
            .andWhere('b.deleted_at IS NULL')
            .getMany();

        for (const bill of overdueBills) {
            const orgUsers = await this.orgUserRepo.find({
                where: { organisationId: bill.organisationId, role: In(['OWNER', 'MANAGER']), isActive: true },
            });
            const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
            if (userIds.length > 0) {
                this.notificationsService.sendToUsers({
                    userIds,
                    title: 'Invoice Overdue',
                    body: `Bill ${bill.billNumber} (₹${parseFloat(bill.total as any).toLocaleString('en-IN')}) is overdue`,
                    data: { billId: bill.id, type: 'invoice_overdue' },
                }).catch(() => {});
            }
        }

        // Bills due in 3 days
        const dueSoonBills = await this.billRepo
            .createQueryBuilder('b')
            .where('b.status NOT IN (:...paidStatuses)', { paidStatuses: [BillStatus.PAID, BillStatus.CANCELLED] })
            .andWhere('b.due_date = :in3days', { in3days })
            .andWhere('b.deleted_at IS NULL')
            .getMany();

        for (const bill of dueSoonBills) {
            const orgUsers = await this.orgUserRepo.find({
                where: { organisationId: bill.organisationId, role: In(['OWNER', 'MANAGER']), isActive: true },
            });
            const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
            if (userIds.length > 0) {
                this.notificationsService.sendToUsers({
                    userIds,
                    title: 'Invoice Due Soon',
                    body: `Bill ${bill.billNumber} (₹${parseFloat(bill.total as any).toLocaleString('en-IN')}) is due in 3 days`,
                    data: { billId: bill.id, type: 'invoice_due_soon' },
                }).catch(() => {});
            }
        }
    }

    // --- Daily stock check — runs daily at 07:00 ---
    @Cron('0 7 * * *')
    async alertLowStock() {
        const lowItems = await this.inventoryRepo
            .createQueryBuilder('i')
            .where('i.current_stock <= i.min_stock_level')
            .andWhere('i.is_active = true')
            .getMany();

        // Group by org and send one digest per org
        const byOrg = new Map<string, number>();
        for (const item of lowItems) {
            byOrg.set(item.organisationId, (byOrg.get(item.organisationId) ?? 0) + 1);
        }

        for (const [orgId, count] of byOrg) {
            const orgUsers = await this.orgUserRepo.find({
                where: { organisationId: orgId, role: In(['OWNER', 'MANAGER']), isActive: true },
            });
            const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
            if (userIds.length > 0) {
                this.notificationsService.sendToUsers({
                    userIds,
                    title: 'Low Stock Alert',
                    body: `${count} item${count !== 1 ? 's are' : ' is'} below minimum stock levels`,
                    data: { type: 'low_stock', count },
                }).catch(() => {});
            }
        }
    }

    // --- Daily duty reminder — runs daily at 20:00 ---
    @Cron('0 20 * * *')
    async sendDailyDutyReminders() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const duties = await this.dutyRepo
            .createQueryBuilder('d')
            .where('d.duty_date = :tomorrow', { tomorrow: tomorrowStr })
            .andWhere('d.status = :status', { status: 'scheduled' })
            .andWhere('d.deleted_at IS NULL')
            .getMany();

        for (const duty of duties) {
            const staff = await this.staffRepo.findOne({ where: { id: duty.staffId } });
            if (staff?.userId) {
                this.notificationsService.sendToUsers({
                    userIds: [staff.userId],
                    title: 'Duty Tomorrow',
                    body: `You have a duty shift tomorrow from ${duty.startTime} to ${duty.endTime}`,
                    data: { dutyId: duty.id, type: 'duty_reminder' },
                }).catch(() => {});
            }
        }
    }

    // --- Daily appointment summary — runs daily at 07:00 ---
    @Cron('0 7 * * *')
    async sendDailyAppointmentSummary() {
        const today = new Date().toISOString().split('T')[0];

        const appointments = await this.appointmentRepo
            .createQueryBuilder('a')
            .where('a.appointment_date = :today', { today })
            .andWhere('a.status = :status', { status: AppointmentStatus.SCHEDULED })
            .andWhere('a.deleted_at IS NULL')
            .getMany();

        // Group by org
        const byOrg = new Map<string, typeof appointments>();
        for (const appt of appointments) {
            const list = byOrg.get(appt.organisationId) ?? [];
            list.push(appt);
            byOrg.set(appt.organisationId, list);
        }

        for (const [orgId, appts] of byOrg) {
            const orgUsers = await this.orgUserRepo.find({
                where: { organisationId: orgId, role: In(['OWNER', 'MANAGER', 'RECEPTIONIST']), isActive: true },
            });
            const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
            if (userIds.length > 0) {
                this.notificationsService.sendToUsers({
                    userIds,
                    title: "Today's Appointments",
                    body: `${appts.length} appointment${appts.length !== 1 ? 's' : ''} scheduled for today`,
                    data: { type: 'appointment_daily_summary', count: appts.length },
                }).catch(() => {});
            }
        }
    }

    // --- CRM Tasks overdue — runs daily at 08:00 ---
    @Cron('0 8 * * *')
    async alertOverdueCrmTasks() {
        const today = new Date().toISOString().split('T')[0];

        const tasks = await this.crmTaskRepo
            .createQueryBuilder('t')
            .where('t.status NOT IN (:...doneStatuses)', { doneStatuses: ['completed', 'cancelled'] })
            .andWhere('t.due_at < :today', { today })
            .andWhere('t.deleted_at IS NULL')
            .getMany();

        for (const task of tasks) {
            if (task.assigneeUserId) {
                this.notificationsService.sendToUsers({
                    userIds: [task.assigneeUserId],
                    title: 'CRM Follow-up Overdue',
                    body: `Your follow-up task "${task.title}" is overdue`,
                    data: { crmTaskId: task.id, type: 'crm_task_overdue' },
                }).catch(() => {});
            }
        }
    }

    // --- CRM Tasks due today — runs daily at 08:00 ---
    @Cron('0 8 * * *')
    async alertCrmTasksDueToday() {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const tasks = await this.crmTaskRepo
            .createQueryBuilder('t')
            .where('t.status NOT IN (:...doneStatuses)', { doneStatuses: ['completed', 'cancelled'] })
            .andWhere('t.due_at >= :today AND t.due_at < :tomorrow', { today, tomorrow: tomorrowStr })
            .andWhere('t.deleted_at IS NULL')
            .getMany();

        for (const task of tasks) {
            if (task.assigneeUserId) {
                this.notificationsService.sendToUsers({
                    userIds: [task.assigneeUserId],
                    title: 'CRM Follow-up Due Today',
                    body: `You have a follow-up task "${task.title}" due today`,
                    data: { crmTaskId: task.id, type: 'crm_task_due_today' },
                }).catch(() => {});
            }
        }
    }
}
