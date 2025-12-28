import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { GetInvoicesDto } from './dto/get-invoices.dto';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(userId: string, userRole: string, query: GetInvoicesDto) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.order', 'order')
      .where('invoice.deletedAt IS NULL');

    // Role-based filtering
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });
      if (user && user.clinicId) {
        queryBuilder.andWhere('order.clinicId = :clinicId', {
          clinicId: user.clinicId,
        });
      } else {
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }
    }
    // Admin and support can see all invoices

    // Note: Status filtering would require checking order payment status
    // For now, we'll return all invoices and let frontend filter

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('invoice.createdAt', 'DESC');

    const data = await queryBuilder.getMany();

    // Transform to match frontend expectations
    const transformedData = data.map((invoice) => ({
      ...invoice,
      status: this.getInvoiceStatus(invoice),
    }));

    return {
      data: transformedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const invoice = await this.invoicesRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['order'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    // Role-based access control
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });
      if (!user || user.clinicId !== invoice.order.clinicId) {
        throw new ForbiddenException('You do not have access to this invoice');
      }
    }

    return {
      ...invoice,
      status: this.getInvoiceStatus(invoice),
    };
  }

  private getInvoiceStatus(invoice: Invoice): string {
    // Determine status based on due date and payment
    // This is a simplified version - you may need to check payment records
    if (invoice.dueDate) {
      const today = new Date();
      const dueDate = new Date(invoice.dueDate);
      if (dueDate < today) {
        return 'overdue';
      }
    }
    // Default to pending - you may want to check actual payment status
    return 'pending';
  }
}
