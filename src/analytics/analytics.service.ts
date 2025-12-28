import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Dispute, DisputeStatus } from '../disputes/entities/dispute.entity';
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
      // Get active clinics count
      const activeClinics = await this.organisationsRepository.count({
        where: { type: 'CLINIC', deletedAt: IsNull() },
      });

      // Get active manufacturers count
      const activeManufacturers = await this.organisationsRepository.count({
        where: { type: 'MANUFACTURER', deletedAt: IsNull() },
      });

      // Get pending disputes count (handle case where table doesn't exist)
      let pendingDisputes = 0;
      try {
        pendingDisputes = await this.disputesRepository.count({
          where: { status: DisputeStatus.OPEN, deletedAt: IsNull() },
        });
      } catch (error) {
        // If disputes table doesn't exist, return 0
        if (error.message && error.message.includes('does not exist')) {
          console.warn(
            '[Analytics Service] Disputes table does not exist, returning 0 for pending disputes',
          );
          pendingDisputes = 0;
        } else {
          throw error;
        }
      }

      // TODO: Orders table doesn't exist yet - return zeros for order metrics
      // Once orders table is created, implement proper order analytics
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
        userRole,
        startDate,
        endDate,
      });
      throw error;
    }
  }
}
