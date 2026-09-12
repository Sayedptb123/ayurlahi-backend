import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, SelectQueryBuilder } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { GetInvoicesDto, InvoiceStatus } from './dto/get-invoices.dto';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import { Order, OrderSource } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { RoleUtils } from '../common/utils/role.utils';
import { NotificationsService } from '../notifications/notifications.service';

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
    @InjectRepository(OrganisationUser)
    private orgUserRepository: Repository<OrganisationUser>,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(
    userId: string,
    userRole: string,
    query: GetInvoicesDto,
    organisationId?: string,
    organisationType?: string,
  ) {
    const { page = 1, limit = 20, status, orderId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.order', 'order')
      .where('invoice.deletedAt IS NULL');

    if (orderId) {
      queryBuilder.andWhere('invoice."orderId" = :orderId', { orderId });
    }

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
    } else if (organisationType !== 'AYURLAHI_TEAM') {
      // SEC-7: unknown/missing organisationType must never see all invoices.
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
    // AYURLAHI_TEAM: no additional filter — sees all invoices.

    if (status) {
      this.applyStatusFilter(queryBuilder, status);
    }

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('invoice.createdAt', 'DESC');

    const data = await queryBuilder.getMany();
    await this.attachOrderIdentity(data);

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

  // Aggregated in SQL, not by summing a paginated fetch client-side — the
  // list is capped per page, so client-side summation would silently be
  // wrong past the first page. Mirrors applyStatusFilter's isPaid/dueDate
  // logic exactly, so these totals never disagree with what the status
  // tabs actually show.
  async getSummary(organisationId?: string, organisationType?: string) {
    const zero = {
      totalOutstanding: 0,
      totalPaid: 0,
      overdueAmount: 0,
      pendingCount: 0,
      paidCount: 0,
      overdueCount: 0,
    };

    const queryBuilder = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.order', 'order')
      .where('invoice.deletedAt IS NULL');

    if (organisationType === 'CLINIC') {
      if (!organisationId) return zero;
      queryBuilder.andWhere('order.organisation_id = :orgId', { orgId: organisationId });
    } else if (organisationType === 'MANUFACTURER') {
      if (!organisationId) return zero;
      queryBuilder.andWhere(
        `EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = invoice."orderId" AND oi.manufacturer_id = :mfgId)`,
        { mfgId: organisationId },
      );
    } else if (organisationType !== 'AYURLAHI_TEAM') {
      // SEC-7: unknown/missing organisationType must never see the global summary.
      return zero;
    }
    // AYURLAHI_TEAM: no additional filter — summary across every invoice.

    const raw = await queryBuilder
      .select(`COALESCE(SUM(CASE WHEN invoice."isPaid" = true THEN invoice."totalAmount" ELSE 0 END), 0)`, 'totalPaid')
      .addSelect(`COALESCE(SUM(CASE WHEN invoice."isPaid" = false THEN invoice."totalAmount" ELSE 0 END), 0)`, 'totalOutstanding')
      .addSelect(`COALESCE(SUM(CASE WHEN invoice."isPaid" = false AND invoice."dueDate" < NOW() THEN invoice."totalAmount" ELSE 0 END), 0)`, 'overdueAmount')
      .addSelect(`COUNT(*) FILTER (WHERE invoice."isPaid" = true)`, 'paidCount')
      .addSelect(`COUNT(*) FILTER (WHERE invoice."isPaid" = false AND (invoice."dueDate" IS NULL OR invoice."dueDate" >= NOW()))`, 'pendingCount')
      .addSelect(`COUNT(*) FILTER (WHERE invoice."isPaid" = false AND invoice."dueDate" < NOW())`, 'overdueCount')
      .getRawOne();

    return {
      totalOutstanding: parseFloat(raw.totalOutstanding) || 0,
      totalPaid: parseFloat(raw.totalPaid) || 0,
      overdueAmount: parseFloat(raw.overdueAmount) || 0,
      pendingCount: parseInt(raw.pendingCount, 10) || 0,
      paidCount: parseInt(raw.paidCount, 10) || 0,
      overdueCount: parseInt(raw.overdueCount, 10) || 0,
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
    await this.attachOrderIdentity([invoice]);

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

    // markAsPaid previously fired no notification at all — the clinic had
    // no way to know their payment had been recorded short of opening the
    // Invoices screen. Uses invoice_paid, the type notificationRouting.ts
    // already had a route ready for but no backend event ever emitted.
    const clinicOrgId = invoice.order?.organisationId;
    if (clinicOrgId) {
      this.orgUserRepository
        .find({ where: { organisationId: clinicOrgId, role: In(['OWNER', 'MANAGER', 'ADMIN']), isActive: true } })
        .then((orgUsers) => {
          const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
          if (userIds.length > 0) {
            const branchName = (invoice.order?.shippingAddress as any)?.name as string | undefined;
            const branchLabel = branchName ? ` (${branchName})` : '';
            this.notificationsService.sendToUsers({
              userIds,
              title: 'Payment Recorded',
              body: `Payment of ₹${Number(invoice.paidAmount).toFixed(2)} for Invoice ${invoice.invoiceNumber}${branchLabel} has been recorded`,
              data: { orderId: invoice.orderId, invoiceId: invoice.id, type: 'invoice_paid', organisationId: clinicOrgId },
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

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
    if (organisationType !== 'AYURLAHI_TEAM') {
      // SEC-7: unknown/missing organisationType must never read an invoice.
      throw new ForbiddenException('You do not have access to this invoice');
    }
    // AYURLAHI_TEAM: no restriction.
  }

  // Invoice.order carries organisationId/branchId (plain columns, no ORM
  // relation to organisations/branches), but the Invoices screen had no way
  // to show which clinic or which branch of a multi-branch clinic (e.g.
  // PMS's 3 branches) an invoice belongs to -- mirrors
  // OrdersService.attachClinicNames/attachBranchNames. Mutates
  // invoice.order in place so the caller's existing `{ ...invoice }` spread
  // already carries the names once this resolves.
  private async attachOrderIdentity(invoices: Invoice[]): Promise<void> {
    const orgIds = [...new Set(invoices.map((i) => i.order?.organisationId).filter((id): id is string => !!id))];
    const branchIds = [...new Set(invoices.map((i) => i.order?.branchId).filter((id): id is string => !!id))];

    const [orgs, branches] = await Promise.all([
      orgIds.length > 0
        ? (this.invoicesRepository.manager.getRepository('organisations').find({ where: { id: In(orgIds) }, select: ['id', 'name'] }) as Promise<{ id: string; name: string }[]>)
        : Promise.resolve([]),
      branchIds.length > 0
        ? (this.invoicesRepository.manager.getRepository('branches').find({ where: { id: In(branchIds) }, select: ['id', 'name'] }) as Promise<{ id: string; name: string }[]>)
        : Promise.resolve([]),
    ]);

    const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));
    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

    for (const invoice of invoices) {
      if (!invoice.order) continue;
      (invoice.order as any).clinicName = orgNameById.get(invoice.order.organisationId) ?? null;
      (invoice.order as any).branchName = invoice.order.branchId ? branchNameById.get(invoice.order.branchId) ?? null : null;
    }
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
