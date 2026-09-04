import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, SelectQueryBuilder } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { GetInvoicesDto, InvoiceStatus } from './dto/get-invoices.dto';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import { Order, OrderSource } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { User } from '../users/entities/user.entity';
import { RoleUtils } from '../common/utils/role.utils';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(
    userId: string,
    userRole: string,
    query: GetInvoicesDto,
    organisationId?: string,
    organisationType?: string,
  ) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.order', 'order')
      .where('invoice.deletedAt IS NULL');

    // Multi-tenancy: scope to the caller's own organisation. Team Ayurlahi
    // (AYURLAHI_TEAM) is the only org type allowed to see every invoice,
    // since they mediate every transaction.
    if (organisationType === 'CLINIC') {
      if (!organisationId) {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
      queryBuilder.andWhere('order.organisation_id = :orgId', { orgId: organisationId });
    } else if (organisationType === 'MANUFACTURER') {
      if (!organisationId) {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
      queryBuilder.andWhere(
        `EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = invoice."orderId" AND oi.manufacturer_id = :mfgId)`,
        { mfgId: organisationId },
      );
    }
    // AYURLAHI_TEAM: no additional filter — sees all invoices.

    if (status) {
      this.applyStatusFilter(queryBuilder, status);
    }

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('invoice.createdAt', 'DESC');

    const data = await queryBuilder.getMany();

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

  private applyStatusFilter(
    queryBuilder: SelectQueryBuilder<Invoice>,
    status: InvoiceStatus,
  ) {
    if (status === InvoiceStatus.PAID) {
      queryBuilder.andWhere('invoice."isPaid" = true');
    } else if (status === InvoiceStatus.OVERDUE) {
      queryBuilder.andWhere('invoice."isPaid" = false AND invoice."dueDate" < NOW()');
    } else if (status === InvoiceStatus.PENDING) {
      queryBuilder.andWhere(
        'invoice."isPaid" = false AND (invoice."dueDate" IS NULL OR invoice."dueDate" >= NOW())',
      );
    } else if (status === InvoiceStatus.CANCELLED) {
      // No invoice can currently be cancelled — nothing to match.
      queryBuilder.andWhere('1 = 0');
    }
  }

  async findOne(id: string, userId: string, userRole: string, organisationId?: string, organisationType?: string) {
    const invoice = await this.invoicesRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['order'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    await this.assertCanAccess(invoice, organisationId, organisationType);

    return {
      ...invoice,
      status: this.getInvoiceStatus(invoice),
    };
  }

  async markAsPaid(
    id: string,
    userId: string,
    userRole: string,
    dto: MarkInvoicePaidDto,
    organisationId?: string,
    organisationType?: string,
  ) {
    const invoice = await this.invoicesRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['order', 'order.items'],
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    // Ayurlahi admin/support can always confirm payment (marketplace or
    // external orders). A manufacturer can additionally self-confirm payment
    // only on their OWN external orders — the clinic paid PMS directly for a
    // WhatsApp order, so Ayurlahi Team doesn't need to be the one to record
    // it. Marketplace-order payment confirmation is unchanged: Team-only.
    const isManufacturerSelfConfirmingOwnExternalOrder =
      organisationType === 'MANUFACTURER' &&
      ['OWNER', 'MANAGER', 'ADMIN'].includes((userRole || '').toUpperCase()) &&
      invoice.order?.source === OrderSource.EXTERNAL &&
      invoice.order?.items?.some((item) => item.manufacturerId === organisationId);

    if (!RoleUtils.isAdminOrSupport(userRole) && !isManufacturerSelfConfirmingOwnExternalOrder) {
      throw new ForbiddenException('Only Ayurlahi admin/support can record invoice payments');
    }

    invoice.isPaid = true;
    invoice.paidAt = new Date();
    invoice.paidAmount = dto.paidAmount ?? Number(invoice.totalAmount);
    invoice.paymentNotes = dto.notes || null;
    invoice.paymentRecordedBy = userId;

    await this.invoicesRepository.save(invoice);

    return {
      ...invoice,
      status: this.getInvoiceStatus(invoice),
    };
  }

  private async assertCanAccess(invoice: Invoice, organisationId?: string, organisationType?: string) {
    if (organisationType === 'CLINIC') {
      if (invoice.order?.organisationId !== organisationId) {
        throw new ForbiddenException('You do not have access to this invoice');
      }
      return;
    }
    if (organisationType === 'MANUFACTURER') {
      const belongs = await this.orderItemsRepository.exist({
        where: { orderId: invoice.orderId, manufacturerId: organisationId },
      });
      if (!belongs) {
        throw new ForbiddenException('You do not have access to this invoice');
      }
      return;
    }
    // AYURLAHI_TEAM: no restriction.
  }

  private getInvoiceStatus(invoice: Invoice): string {
    if (invoice.isPaid) {
      return 'paid';
    }
    if (invoice.dueDate) {
      const today = new Date();
      const dueDate = new Date(invoice.dueDate);
      if (dueDate < today) {
        return 'overdue';
      }
    }
    return 'pending';
  }
}
