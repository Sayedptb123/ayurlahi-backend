import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Manufacturer } from '../manufacturers/entities/manufacturer.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Clinic)
    private clinicsRepository: Repository<Clinic>,
    @InjectRepository(Manufacturer)
    private manufacturersRepository: Repository<Manufacturer>,
  ) {}

  async getDashboardStats(
    userRole: string,
    startDate?: string,
    endDate?: string,
  ) {
    if (!['admin', 'support'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to view analytics');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Build date filter for orders if provided
    const ordersQueryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.deletedAt IS NULL');

    if (start) {
      ordersQueryBuilder.andWhere('order.createdAt >= :start', { start });
    }
    if (end) {
      ordersQueryBuilder.andWhere('order.createdAt <= :end', { end });
    }

    // Get total orders
    const totalOrders = await ordersQueryBuilder.getCount();

    // Get orders by status
    const statusQueryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('order.deletedAt IS NULL');

    if (start) {
      statusQueryBuilder.andWhere('order.createdAt >= :start', { start });
    }
    if (end) {
      statusQueryBuilder.andWhere('order.createdAt <= :end', { end });
    }

    const ordersByStatus = await statusQueryBuilder
      .groupBy('order.status')
      .getRawMany();

    const statusCounts: Record<string, number> = {};
    ordersByStatus.forEach((row) => {
      statusCounts[row.status] = parseInt(row.count, 10);
    });

    // Get total revenue (sum of all order totals)
    const revenueQueryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.deletedAt IS NULL');

    if (start) {
      revenueQueryBuilder.andWhere('order.createdAt >= :start', { start });
    }
    if (end) {
      revenueQueryBuilder.andWhere('order.createdAt <= :end', { end });
    }

    const revenueResult = await revenueQueryBuilder.getRawOne();

    const totalRevenue = parseFloat(revenueResult?.total || '0');

    // Get total commission (sum of platform fees)
    const commissionQueryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .select('SUM(order.platformFee)', 'total')
      .where('order.deletedAt IS NULL');

    if (start) {
      commissionQueryBuilder.andWhere('order.createdAt >= :start', { start });
    }
    if (end) {
      commissionQueryBuilder.andWhere('order.createdAt <= :end', { end });
    }

    const commissionResult = await commissionQueryBuilder.getRawOne();

    const totalCommission = parseFloat(commissionResult?.total || '0');

    // Get active clinics count
    const activeClinics = await this.clinicsRepository.count({
      where: { deletedAt: IsNull() },
    });

    // Get active manufacturers count
    const activeManufacturers = await this.manufacturersRepository.count({
      where: { deletedAt: IsNull() },
    });

    // Get pending disputes count
    const pendingDisputes = await this.ordersRepository.manager
      .getRepository('disputes')
      .count({
        where: { status: 'open', deletedAt: IsNull() },
      });

    // Get recent orders (last 10)
    const recentOrdersQueryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.deletedAt IS NULL')
      .orderBy('order.createdAt', 'DESC')
      .take(10);

    if (start) {
      recentOrdersQueryBuilder.andWhere('order.createdAt >= :start', { start });
    }
    if (end) {
      recentOrdersQueryBuilder.andWhere('order.createdAt <= :end', { end });
    }

    const recentOrders = await recentOrdersQueryBuilder.getMany();

    // Calculate revenue by period (last 6 months)
    const revenueByPeriod: Array<{ period: string; revenue: number; orders: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const periodRevenueResult = await this.ordersRepository
        .createQueryBuilder('order')
        .select('SUM(order.totalAmount)', 'revenue')
        .addSelect('COUNT(*)', 'orders')
        .where('order.deletedAt IS NULL')
        .andWhere('order.createdAt >= :start', { start: periodStart })
        .andWhere('order.createdAt <= :end', { end: periodEnd })
        .getRawOne();

      revenueByPeriod.push({
        period: periodStart.toISOString().substring(0, 7), // YYYY-MM format
        revenue: parseFloat(periodRevenueResult?.revenue || '0'),
        orders: parseInt(periodRevenueResult?.orders || '0', 10),
      });
    }

    return {
      totalRevenue,
      totalOrders,
      totalCommissions: totalCommission, // Match frontend interface
      activeClinics,
      activeManufacturers,
      pendingDisputes,
      ordersByStatus: statusCounts,
      revenueByPeriod,
    };
  }
}

