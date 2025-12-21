import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Payment } from '../payments/entities/payment.entity';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/role.enum';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Manufacturer } from '../manufacturers/entities/manufacturer.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Clinic)
    private clinicsRepository: Repository<Clinic>,
    @InjectRepository(Manufacturer)
    private manufacturersRepository: Repository<Manufacturer>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async getDashboard() {
    // Get counts
    const [
      totalOrders,
      totalPayments,
      totalUsers,
      totalClinics,
      totalManufacturers,
      totalProducts,
      pendingOrders,
      confirmedOrders,
      completedPayments,
      totalRevenue,
    ] = await Promise.all([
      this.ordersRepository.count(),
      this.paymentsRepository.count(),
      this.usersRepository.count(),
      this.clinicsRepository.count({ where: { approvalStatus: 'approved' } }),
      this.manufacturersRepository.count({ where: { approvalStatus: 'approved' } }),
      this.productsRepository.count(),
      this.ordersRepository.count({ where: { status: OrderStatus.PENDING } }),
      this.ordersRepository.count({ where: { status: OrderStatus.CONFIRMED } }),
      this.paymentsRepository.count({
        where: { status: PaymentStatus.CAPTURED },
      }),
      this.paymentsRepository
        .createQueryBuilder('payment')
        .select('SUM(payment.amount)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.CAPTURED })
        .getRawOne()
        .then((result) => parseFloat(result?.total || '0')),
    ]);

    // Get recent orders
    const recentOrders = await this.ordersRepository.find({
      take: 10,
      order: { createdAt: 'DESC' },
      relations: ['clinic', 'items', 'items.product'],
    });

    // Get revenue by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select("TO_CHAR(payment.createdAt, 'YYYY-MM')", 'month')
      .addSelect('SUM(payment.amount)', 'revenue')
      .where('payment.status = :status', { status: PaymentStatus.CAPTURED })
      .andWhere('payment.createdAt >= :date', { date: sixMonthsAgo })
      .groupBy("TO_CHAR(payment.createdAt, 'YYYY-MM')")
      .orderBy("TO_CHAR(payment.createdAt, 'YYYY-MM')", 'ASC')
      .getRawMany();

    return {
      overview: {
        totalOrders,
        totalPayments,
        totalUsers,
        totalClinics,
        totalManufacturers,
        totalProducts,
        pendingOrders,
        confirmedOrders,
        completedPayments,
        totalRevenue,
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        clinicName: order.clinic?.clinicName,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        itemCount: order.items?.length || 0,
      })),
      monthlyRevenue: monthlyRevenue.map((item) => ({
        month: item.month,
        revenue: parseFloat(item.revenue || '0'),
      })),
    };
  }
}


