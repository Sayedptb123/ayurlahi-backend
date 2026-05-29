import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Dispute, DisputeStatus } from '../disputes/entities/dispute.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { PatientBill } from '../patient-billing/entities/patient-bill.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { RoleUtils } from '../common/utils/role.utils';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Organisation)
    private organisationsRepository: Repository<Organisation>,
    @InjectRepository(Dispute)
    private disputesRepository: Repository<Dispute>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
    @InjectRepository(PatientBill)
    private billsRepository: Repository<PatientBill>,
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
  ) { }

  async getDashboardStats(
    userRole: string,
    startDate?: string,
    endDate?: string,
  ) {
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to view analytics',
      );
    }

    try {
      const activeClinics = await this.organisationsRepository.count({
        where: { type: 'CLINIC', deletedAt: IsNull() },
      });

      const activeManufacturers = await this.organisationsRepository.count({
        where: { type: 'MANUFACTURER', deletedAt: IsNull() },
      });

      let pendingDisputes = 0;
      try {
        pendingDisputes = await this.disputesRepository.count({
          where: { status: DisputeStatus.OPEN, deletedAt: IsNull() },
        });
      } catch (error) {
        if (error.message && error.message.includes('does not exist')) {
          pendingDisputes = 0;
        } else {
          throw error;
        }
      }

      return {
        totalRevenue: 0,
        totalOrders: 0,
        totalCommissions: 0,
        activeClinics,
        activeManufacturers,
        pendingDisputes,
        ordersByStatus: {},
        revenueByPeriod: [],
      };
    } catch (error) {
      console.error('[Analytics Service] Error in getDashboardStats:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async getClinicDashboard(
    organisationId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const dateFilter = (col: string) => {
      const parts: string[] = [];
      if (startDate) parts.push(`${col} >= '${startDate}'`);
      if (endDate) parts.push(`${col} <= '${endDate}'`);
      return parts.length ? parts.join(' AND ') : null;
    };

    // Total patients
    const totalPatients = await this.patientsRepository
      .createQueryBuilder('p')
      .where('p.organisationId = :organisationId', { organisationId })
      .andWhere('p.deletedAt IS NULL')
      .getCount();

    // Total appointments
    const apptQb = this.appointmentsRepository
      .createQueryBuilder('a')
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL');
    const apptDateFilter = dateFilter('a.appointmentDate');
    if (apptDateFilter) apptQb.andWhere(apptDateFilter);
    const totalAppointments = await apptQb.getCount();

    // Appointments by status
    const apptByStatusQb = this.appointmentsRepository
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL')
      .groupBy('a.status');
    const apptByStatusDateFilter = dateFilter('a.appointmentDate');
    if (apptByStatusDateFilter) apptByStatusQb.andWhere(apptByStatusDateFilter);
    const apptByStatusRaw = await apptByStatusQb.getRawMany();
    const appointmentsByStatus = apptByStatusRaw.map((r) => ({
      status: r.status,
      count: parseInt(r.count, 10),
    }));

    // Revenue from paid/partial bills
    const revenueQb = this.billsRepository
      .createQueryBuilder('b')
      .select('COALESCE(SUM(b.paidAmount), 0)', 'revenue')
      .where('b.organisationId = :organisationId', { organisationId })
      .andWhere('b.deletedAt IS NULL')
      .andWhere("b.status IN ('paid', 'partial')");
    const billDateFilter = dateFilter('b.billDate');
    if (billDateFilter) revenueQb.andWhere(billDateFilter);
    const revenueResult = await revenueQb.getRawOne();
    const totalRevenue = parseFloat(revenueResult?.revenue ?? '0');

    // Total expenses
    const expQb = this.expensesRepository
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.organisationId = :organisationId', { organisationId })
      .andWhere('e.deletedAt IS NULL');
    const expDateFilter = dateFilter('e.expenseDate');
    if (expDateFilter) expQb.andWhere(expDateFilter);
    const expResult = await expQb.getRawOne();
    const totalExpenses = parseFloat(expResult?.total ?? '0');

    // Revenue by month (last 12 months or within date range)
    const revenueByMonthQb = this.billsRepository
      .createQueryBuilder('b')
      .select("TO_CHAR(b.billDate, 'Mon YYYY')", 'month')
      .addSelect("DATE_TRUNC('month', b.billDate)", 'monthStart')
      .addSelect('COALESCE(SUM(b.paidAmount), 0)', 'amount')
      .where('b.organisationId = :organisationId', { organisationId })
      .andWhere('b.deletedAt IS NULL')
      .andWhere("b.status IN ('paid', 'partial')")
      .groupBy("TO_CHAR(b.billDate, 'Mon YYYY'), DATE_TRUNC('month', b.billDate)")
      .orderBy("DATE_TRUNC('month', b.billDate)", 'ASC')
      .limit(12);
    if (billDateFilter) revenueByMonthQb.andWhere(billDateFilter);
    const revenueByMonthRaw = await revenueByMonthQb.getRawMany();
    const revenueByMonth = revenueByMonthRaw.map((r) => ({
      month: r.month,
      amount: parseFloat(r.amount),
    }));

    return {
      totalPatients,
      totalAppointments,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      appointmentsByStatus,
      revenueByMonth,
    };
  }
}
