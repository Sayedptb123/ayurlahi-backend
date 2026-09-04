import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Order, OrderStatus, OrderSource } from './entities/order.entity';
import { OrderItem, OrderItemStatus } from './entities/order-item.entity';
import { ManufacturerExternalOrderAccess } from './entities/manufacturer-external-order-access.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AssignOrderItemDto } from './dto/assign-order-item.dto';
import { CreateExternalOrderDto } from './dto/create-external-order.dto';
import { GrantExternalOrderAccessDto } from './dto/grant-external-order-access.dto';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RoleUtils } from '../common/utils/role.utils';
import { Invoice } from '../invoices/entities/invoice.entity';

// Valid order status transitions. Anything not in the allowed set is rejected.
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.CANCELLED]: [], // terminal
  [OrderStatus.RETURNED]: [], // terminal
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(OrganisationUser)
    private orgUserRepository: Repository<OrganisationUser>,
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(ManufacturerExternalOrderAccess)
    private externalOrderAccessRepository: Repository<ManufacturerExternalOrderAccess>,
    private inventoryService: InventoryService,
    private notificationsService: NotificationsService,
  ) { }

  async findAll(userId: string, userRole: string, organisationType: string | undefined, query: GetOrdersDto, organisationId?: string) {
    const { page = 1, limit = 20, status, source } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.deletedAt IS NULL');

    // Role-based filtering using organisationType from JWT
    if (organisationType === 'CLINIC') {
      if (organisationId) {
        queryBuilder.andWhere('order.organisation_id = :orgId', { orgId: organisationId });
      } else {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
    } else if (organisationType === 'MANUFACTURER') {
      if (organisationId) {
        queryBuilder.andWhere('items.manufacturerId = :manufacturerId', { manufacturerId: organisationId });
      } else {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
    }
    // Admin and support can see all orders

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (source) {
      queryBuilder.andWhere('order.source = :source', { source });
    }

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('order.createdAt', 'DESC');

    const data = await queryBuilder.getMany();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: string, organisationType: string | undefined, organisationId?: string) {
    const order = await this.ordersRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Role-based access control using organisationType from JWT
    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== order.organisationId) {
        throw new ForbiddenException('You do not have access to this order');
      }
    } else if (organisationType === 'MANUFACTURER') {
      if (!organisationId) {
        throw new ForbiddenException('You do not have access to this order');
      }
      const hasManufacturerItems = order.items.some(
        (item) => item.manufacturerId === organisationId,
      );
      if (!hasManufacturerItems) {
        throw new ForbiddenException('You do not have access to this order');
      }
    }

    return order;
  }

  async create(userId: string, createOrderDto: CreateOrderDto, organisationType?: string, organisationId?: string) {
    if (organisationType !== 'CLINIC' || !organisationId) {
      throw new ForbiddenException('Only clinic users can create orders');
    }

    const clinicId = organisationId;
    const clinic = await this.ordersRepository.manager
      .getRepository('organisations')
      .findOne({ where: { id: clinicId } });

    if (!clinic) {
      throw new BadRequestException('Clinic not found');
    }

    const { orderItems, subtotal, totalGstAmount } = await this.lockAndSnapshotOrderItems(createOrderDto.items);

    const shippingCharges = 0;
    const platformFee = 0;
    const totalAmount = subtotal + totalGstAmount + shippingCharges + platformFee;

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const order = this.ordersRepository.create({
      organisationId: clinicId,
      orderNumber,
      status: OrderStatus.PENDING,
      source: createOrderDto.source || OrderSource.WEB,
      subtotal,
      gstAmount: totalGstAmount,
      shippingCharges,
      platformFee,
      totalAmount,
      shippingAddress: {
        line1: createOrderDto.shippingAddress ?? undefined,
        city: createOrderDto.shippingCity ?? undefined,
        district: createOrderDto.shippingDistrict ?? undefined,
        state: createOrderDto.shippingState ?? undefined,
        pincode: createOrderDto.shippingPincode ?? undefined,
        phone: createOrderDto.shippingPhone ?? undefined,
        name: createOrderDto.shippingContactName ?? undefined,
      },
      notes: createOrderDto.notes || null,
      items: orderItems as OrderItem[],
    } as any) as unknown as Order;

    const savedOrder = (await this.ordersRepository.save(order)) as unknown as Order;

    // Reload order with relations
    const orderWithRelations = await this.ordersRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['items'],
    });

    // Notify manufacturer owners/managers about new order
    const manufacturerIds = [...new Set(orderItems.map((i) => i.manufacturerId).filter(Boolean))];
    const itemSummary = orderWithRelations?.items?.map((i) => `${i.productName} x${i.quantity}`).join(', ') ?? '';
    if (manufacturerIds.length > 0) {
      this.orgUserRepository
        .find({ where: { organisationId: In(manufacturerIds), role: In(['OWNER', 'MANAGER', 'ADMIN']), isActive: true } })
        .then((orgUsers) => {
          const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
          if (userIds.length > 0) {
            this.notificationsService.sendToUsers({
              userIds,
              title: 'New Order Received',
              body: `Order ${orderWithRelations?.orderNumber}: ${itemSummary}`,
              data: { orderId: savedOrder.id, type: 'order_placed' },
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    // Every order also needs Ayurlahi's own fulfillment team notified —
    // this is a universal workflow (Ayurlahi always forwards to the
    // manufacturer and handles pickup), not conditional on anything.
    // See scope/Order_Fulfillment_Routing_Plan.md.
    this.orgUserRepository
      .find({
        where: {
          organisationId: OrdersService.AYURLAHI_TEAM_ORG_ID,
          role: In(['FIELD_STAFF', 'TEAM_LEAD', 'SUPPORT']),
          isActive: true,
        },
      })
      .then((orgUsers) => {
        const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
        if (userIds.length > 0) {
          this.notificationsService.sendToUsers({
            userIds,
            title: 'New Order to Fulfill',
            body: `Order ${orderWithRelations?.orderNumber}: ${itemSummary} — forward to manufacturer and assign pickup`,
            data: { orderId: savedOrder.id, type: 'order_needs_fulfillment' },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return orderWithRelations;
  }

  /**
   * Shared by create() and createExternalOrder(): validates, pessimistic-locks,
   * and decrements stock for a set of items inside a transaction, then builds
   * the OrderItem snapshots (price/MRP/HSN/GST/commission) from the
   * locked-and-decremented products.
   *
   * priceOverrides (external orders only) maps productId -> manufacturer-
   * agreed unit price. When present for a product, that price drives
   * subtotal/GST/total instead of the catalog price, and the real catalog
   * price is preserved separately on catalogPriceAtOrder for audit — the
   * master product price itself is never written to here either way.
   */
  private async lockAndSnapshotOrderItems(
    items: { productId: string; quantity: number; notes?: string }[],
    priceOverrides?: Map<string, number>,
  ): Promise<{ orderItems: Partial<OrderItem>[]; subtotal: number; totalGstAmount: number }> {
    type ProductWithItem = { product: Product; itemDto: (typeof items)[0] };
    const products: ProductWithItem[] = [];

    await this.productsRepository.manager.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);

      for (const item of items) {
        // Pessimistic write lock — blocks concurrent reads until this transaction commits
        const product = await productRepo.findOne({
          where: { id: item.productId, deletedAt: IsNull() },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${item.productId} not found`);
        }
        if (product.status !== 'active') {
          throw new BadRequestException(`Product ${product.name} is not active`);
        }
        if (product.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
          );
        }
        if (item.quantity < product.minOrderQuantity) {
          throw new BadRequestException(
            `Minimum order quantity for ${product.name} is ${product.minOrderQuantity}`,
          );
        }

        // Decrement inside the transaction while the row is locked
        await productRepo.decrement({ id: product.id }, 'stockQuantity', item.quantity);
        product.stockQuantity -= item.quantity;
        products.push({ product, itemDto: item });
      }
    });

    let subtotal = 0;
    let totalGstAmount = 0;
    const orderItems: Partial<OrderItem>[] = [];

    for (const { product, itemDto } of products) {
      const catalogPrice = Number(product.price);
      const override = priceOverrides?.get(product.id);
      const unitPrice = override != null ? override : catalogPrice;

      const itemSubtotal = unitPrice * itemDto.quantity;
      const itemGstAmount = (itemSubtotal * Number(product.gstRate)) / 100;
      const itemTotal = itemSubtotal + itemGstAmount;
      const commissionAmount = (itemTotal * 0.05) / 100;

      subtotal += itemSubtotal;
      totalGstAmount += itemGstAmount;

      orderItems.push({
        productId: product.id,
        manufacturerId: product.manufacturerId,
        productSku: product.sku,
        productName: product.name,
        quantity: itemDto.quantity,
        unitPrice,
        catalogPriceAtOrder: override != null ? catalogPrice : null,
        mrp: product.mrp != null ? Number(product.mrp) : null,
        hsnCode: product.hsnCode || null,
        gstRate: Number(product.gstRate),
        subtotal: itemSubtotal,
        gstAmount: itemGstAmount,
        totalAmount: itemTotal,
        commissionAmount,
        notes: itemDto.notes || null,
      });
    }

    return { orderItems, subtotal, totalGstAmount };
  }

  async reorder(orderId: string, userId: string, organisationId?: string) {
    const originalOrder = await this.findOne(orderId, userId, 'OWNER', 'CLINIC', organisationId);

    const addr = originalOrder.shippingAddress || {};
    const createOrderDto: CreateOrderDto = {
      items: originalOrder.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes || undefined,
      })),
      shippingAddress: (addr as any).line1 || undefined,
      shippingCity: (addr as any).city || undefined,
      shippingDistrict: (addr as any).district || undefined,
      shippingState: (addr as any).state || undefined,
      shippingPincode: (addr as any).pincode || undefined,
      shippingPhone: (addr as any).phone || undefined,
      shippingContactName: (addr as any).name || undefined,
      notes: `Reorder from order ${originalOrder.orderNumber}`,
      source: OrderSource.WEB,
    };

    return this.create(userId, createOrderDto, 'CLINIC', organisationId);
  }

  // ==========================================================================
  // External orders — a manufacturer (e.g. PMS) entering an order they took
  // directly from a clinic outside the platform (WhatsApp/phone) so it becomes
  // a real Ayurlahi order + invoice instead of being billed outside Ayurlahi.
  // See scope/PMS_External_Order_Feature_Scope_2026-09-04.md for the full
  // design and the business decisions behind it.
  // ==========================================================================

  /** Team-only: grant a manufacturer permission to create external orders for a specific clinic. */
  async grantExternalOrderAccess(grantedByUserId: string, dto: GrantExternalOrderAccessDto) {
    const manager = this.externalOrderAccessRepository.manager;
    const [manufacturer, clinic] = await Promise.all([
      manager.getRepository('organisations').findOne({ where: { id: dto.manufacturerId, type: 'MANUFACTURER' } }),
      manager.getRepository('organisations').findOne({ where: { id: dto.clinicId, type: 'CLINIC' } }),
    ]);
    if (!manufacturer) throw new BadRequestException('Manufacturer organisation not found');
    if (!clinic) throw new BadRequestException('Clinic organisation not found');

    const existing = await this.externalOrderAccessRepository.findOne({
      where: { manufacturerId: dto.manufacturerId, clinicId: dto.clinicId },
      withDeleted: true,
    });

    if (existing) {
      existing.isActive = true;
      existing.deletedAt = null;
      existing.notes = dto.notes ?? existing.notes;
      existing.grantedBy = grantedByUserId;
      return this.externalOrderAccessRepository.save(existing);
    }

    return this.externalOrderAccessRepository.save(
      this.externalOrderAccessRepository.create({
        manufacturerId: dto.manufacturerId,
        clinicId: dto.clinicId,
        grantedBy: grantedByUserId,
        notes: dto.notes || null,
        isActive: true,
      }),
    );
  }

  /** Team-only: list access grants, optionally filtered by manufacturer. */
  async listExternalOrderAccessGrants(manufacturerId?: string) {
    const where: any = { isActive: true };
    if (manufacturerId) where.manufacturerId = manufacturerId;
    const grants = await this.externalOrderAccessRepository.find({ where, order: { createdAt: 'DESC' } });

    const orgIds = [...new Set([...grants.map((g) => g.manufacturerId), ...grants.map((g) => g.clinicId)])];
    let orgNames = new Map<string, string>();
    if (orgIds.length > 0) {
      const rows = await this.externalOrderAccessRepository.manager
        .getRepository('organisations')
        .createQueryBuilder('o')
        .select(['o.id', 'o.name'])
        .where('o.id IN (:...ids)', { ids: orgIds })
        .getMany();
      orgNames = new Map(rows.map((r: any) => [r.id, r.name]));
    }

    return grants.map((g) => ({
      ...g,
      manufacturerName: orgNames.get(g.manufacturerId) ?? null,
      clinicName: orgNames.get(g.clinicId) ?? null,
    }));
  }

  /** Team-only: revoke a manufacturer's access to create external orders for a clinic. */
  async revokeExternalOrderAccess(id: string) {
    const grant = await this.externalOrderAccessRepository.findOne({ where: { id } });
    if (!grant) throw new NotFoundException('Access grant not found');
    grant.isActive = false;
    await this.externalOrderAccessRepository.save(grant);
    await this.externalOrderAccessRepository.softDelete(id);
    return { success: true };
  }

  /** Manufacturer-facing: clinics this manufacturer is authorized to create external orders for. Returns only id/name, not full org details. */
  async getAccessibleClinicsForManufacturer(manufacturerId: string) {
    const grants = await this.externalOrderAccessRepository.find({
      where: { manufacturerId, isActive: true },
    });
    if (grants.length === 0) return [];

    const clinicIds = grants.map((g) => g.clinicId);
    const clinics = await this.externalOrderAccessRepository.manager
      .getRepository('organisations')
      .createQueryBuilder('o')
      .select(['o.id', 'o.name'])
      .where('o.id IN (:...ids)', { ids: clinicIds })
      .andWhere('o.deletedAt IS NULL')
      .getMany();

    return clinics.map((c: any) => ({ id: c.id, name: c.name }));
  }

  /** Manufacturer-facing: active branches of a clinic the manufacturer is authorized for. Re-checks the grant server-side — never trust a client-submitted clinicId alone. */
  async getAccessibleClinicBranches(manufacturerId: string, clinicId: string) {
    await this.assertExternalOrderAccess(manufacturerId, clinicId);

    const branches = await this.externalOrderAccessRepository.manager
      .getRepository('branches')
      .createQueryBuilder('branch')
      .where('branch.organisation_id = :clinicId', { clinicId })
      .andWhere('branch.deleted_at IS NULL')
      .andWhere('branch.is_active = true')
      .orderBy('branch.is_primary', 'DESC')
      .addOrderBy('branch.created_at', 'ASC')
      .getMany();

    return (branches as any[]).map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      state: b.state,
      pincode: b.pincode,
      phone: b.phone,
      isPrimary: b.isPrimary,
    }));
  }

  private async assertExternalOrderAccess(manufacturerId: string, clinicId: string): Promise<void> {
    const grant = await this.externalOrderAccessRepository.findOne({
      where: { manufacturerId, clinicId, isActive: true },
    });
    if (!grant) {
      throw new ForbiddenException('You are not authorized to create orders for this clinic');
    }
  }

  /**
   * A manufacturer entering an order on behalf of a clinic they're
   * authorized for (see manufacturer_external_order_access). Always starts
   * PENDING like a normal order and walks the same status lifecycle — even
   * if the medicine was already physically handed over on WhatsApp/phone,
   * there is no fast-tracked "create as DELIVERED" path, by design (one
   * consistent state machine; invoice generation still happens on the
   * DELIVERED transition, unchanged).
   */
  async createExternalOrder(userId: string, manufacturerId: string, dto: CreateExternalOrderDto) {
    await this.assertExternalOrderAccess(manufacturerId, dto.clinicId);

    const branch = await this.ordersRepository.manager
      .getRepository('branches')
      .createQueryBuilder('branch')
      .where('branch.id = :branchId', { branchId: dto.branchId })
      .andWhere('branch.organisation_id = :clinicId', { clinicId: dto.clinicId })
      .andWhere('branch.deleted_at IS NULL')
      .andWhere('branch.is_active = true')
      .getOne();
    if (!branch) {
      throw new BadRequestException('Branch not found for this clinic');
    }

    const priceOverrides = new Map(dto.items.map((i) => [i.productId, i.agreedUnitPrice]));
    const items = dto.items.map((i) => ({ productId: i.productId, quantity: i.quantity, notes: i.notes }));
    const { orderItems, subtotal, totalGstAmount } = await this.lockAndSnapshotOrderItems(items, priceOverrides);

    // A manufacturer may only enter an external order for their own
    // products — re-checked server-side rather than trusted from the
    // product ids submitted, same defense-in-depth as the clinic/branch grant.
    const foreignItems = orderItems.filter((oi) => oi.manufacturerId !== manufacturerId);
    if (foreignItems.length > 0) {
      throw new ForbiddenException('You can only create an external order for your own products');
    }

    const shippingCharges = 0;
    const platformFee = 0;
    const totalAmount = subtotal + totalGstAmount + shippingCharges + platformFee;
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const branchAny = branch as any;

    const order = this.ordersRepository.create({
      organisationId: dto.clinicId,
      orderNumber,
      status: OrderStatus.PENDING,
      source: OrderSource.EXTERNAL,
      subtotal,
      gstAmount: totalGstAmount,
      shippingCharges,
      platformFee,
      totalAmount,
      shippingAddress: {
        line1: branchAny.address ?? undefined,
        city: branchAny.city ?? undefined,
        state: branchAny.state ?? undefined,
        pincode: branchAny.pincode ?? undefined,
        phone: branchAny.phone ?? undefined,
        name: branchAny.name ?? undefined,
      },
      notes: dto.notes || null,
      createdBy: userId,
      metadata: { originalChannel: dto.channel },
      items: orderItems as OrderItem[],
    } as any) as unknown as Order;

    const savedOrder = (await this.ordersRepository.save(order)) as unknown as Order;

    const orderWithRelations = await this.ordersRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['items'],
    });

    // Notify the clinic — they didn't act, PMS created this on their behalf.
    // (Mirrors create()'s manufacturer-notification block, but flipped: the
    // manufacturer here already knows, since they just created it.)
    const itemSummary = orderWithRelations?.items?.map((i) => `${i.productName} x${i.quantity}`).join(', ') ?? '';
    this.orgUserRepository
      .find({ where: { organisationId: dto.clinicId, role: In(['OWNER', 'MANAGER', 'ADMIN']), isActive: true } })
      .then((orgUsers) => {
        const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
        if (userIds.length > 0) {
          this.notificationsService.sendToUsers({
            userIds,
            title: 'Order Recorded on Your Behalf',
            body: `Your manufacturer recorded an order: ${itemSummary}`,
            data: { orderId: savedOrder.id, type: 'external_order_created', organisationId: dto.clinicId },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    // Same universal Ayurlahi fulfillment-team notification every order
    // gets — see the identical block in create() and
    // scope/Order_Fulfillment_Routing_Plan.md.
    this.orgUserRepository
      .find({
        where: {
          organisationId: OrdersService.AYURLAHI_TEAM_ORG_ID,
          role: In(['FIELD_STAFF', 'TEAM_LEAD', 'SUPPORT']),
          isActive: true,
        },
      })
      .then((orgUsers) => {
        const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
        if (userIds.length > 0) {
          this.notificationsService.sendToUsers({
            userIds,
            title: 'New Order to Fulfill',
            body: `Order ${orderWithRelations?.orderNumber}: ${itemSummary} — forward to manufacturer and assign pickup`,
            data: { orderId: savedOrder.id, type: 'order_needs_fulfillment', organisationId: OrdersService.AYURLAHI_TEAM_ORG_ID },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return orderWithRelations;
  }

  async updateStatus(
    id: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    updateDto: UpdateOrderStatusDto,
    organisationId?: string,
  ) {
    const order = await this.findOne(id, userId, userRole, organisationType, organisationId);

    const normalizedRole = RoleUtils.normalizeRole(userRole, organisationType);
    const isManufacturer = normalizedRole === 'manufacturer';
    const isAdmin = ['admin', 'support'].includes(normalizedRole);
    const isClinicCallerOwningOrder =
      normalizedRole === 'clinic' && organisationId && order.organisationId === organisationId;

    // Permission rules:
    //  - admin/support/manufacturer: full status updates
    //  - clinic that owns the order: may only cancel, and only while not yet shipped
    if (!(isAdmin || isManufacturer || isClinicCallerOwningOrder)) {
      throw new ForbiddenException('You do not have permission to update order status');
    }

    if (isClinicCallerOwningOrder && !isAdmin && !isManufacturer) {
      if (updateDto.status !== OrderStatus.CANCELLED) {
        throw new ForbiddenException(
          'Clinics may only cancel their own orders. Other status transitions are reserved for the manufacturer.',
        );
      }
      if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
        throw new BadRequestException(
          `Order cannot be cancelled by clinic once status is "${order.status}". Contact the manufacturer.`,
        );
      }
    }

    // State machine: validate transition (admin/support bypass)
    if (!isAdmin) {
      const allowed = ORDER_TRANSITIONS[order.status] || [];
      if (order.status !== updateDto.status && !allowed.includes(updateDto.status)) {
        throw new BadRequestException(
          `Invalid status transition: ${order.status} → ${updateDto.status}. Allowed from ${order.status}: ${allowed.join(', ') || '(terminal)'}.`,
        );
      }
    }

    // Update status
    order.status = updateDto.status;

    // Update timestamps based on status
    if (updateDto.status === OrderStatus.CONFIRMED && !order.confirmedAt) {
      order.confirmedAt = new Date();
    } else if (updateDto.status === OrderStatus.SHIPPED && !order.shippedAt) {
      order.shippedAt = new Date();
    } else if (
      updateDto.status === OrderStatus.DELIVERED &&
      !order.deliveredAt
    ) {
      order.deliveredAt = new Date();
      // Sync Inventory
      if (order.items && order.items.length > 0) {
        await this.inventoryService.addStock(
          order.organisationId,
          order.items.map((item) => ({
            productId: item.productId,
            sku: item.productSku,
            name: item.productName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            orderId: order.id,
          })),
        );
      }
      // Auto-create invoice record (PDF generation in S3 is deferred to V7;
      // for now we capture the invoice data so accountants can retrieve it).
      await this.createInvoiceForDeliveredOrder(order);
    } else if (
      updateDto.status === OrderStatus.CANCELLED &&
      !order.cancelledAt
    ) {
      order.cancelledAt = new Date();
      order.cancelledBy = userId;
      order.cancellationReason = updateDto.notes || null;

      // Stock is decremented exactly once, at order creation (create()), and
      // never touched again by any other transition — so restoring it here is
      // safe with no double-restore risk, guarded the same way as the
      // timestamp above (!order.cancelledAt) plus CANCELLED being a terminal
      // state in ORDER_TRANSITIONS (no transition ever re-enters this branch).
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          await this.productsRepository.increment({ id: item.productId }, 'stockQuantity', item.quantity);
        }
      }
    }

    const savedOrder = await this.ordersRepository.save(order);

    // Notify the *other side* of the marketplace about status changes:
    //   - manufacturer → clinic for confirmed/shipped/delivered
    //   - whichever party cancelled → notify the other party
    const clinicOrgId = savedOrder.organisationId;
    const mfgOrgId = savedOrder.items?.[0]?.manufacturerId;
    const notifMap: Record<string, { title: string; body: string; type: string }> = {
      [OrderStatus.CONFIRMED]: {
        title: 'Order Confirmed',
        body: `Order ${savedOrder.orderNumber} has been confirmed by the manufacturer`,
        type: 'order_confirmed',
      },
      [OrderStatus.SHIPPED]: {
        title: 'Order Shipped',
        body: `Order ${savedOrder.orderNumber} has been shipped and is on the way`,
        type: 'order_shipped',
      },
      [OrderStatus.DELIVERED]: {
        title: 'Order Delivered',
        body: `Order ${savedOrder.orderNumber} has been delivered. Inventory updated.`,
        type: 'order_delivered',
      },
      [OrderStatus.CANCELLED]: {
        title: 'Order Cancelled',
        body: `Order ${savedOrder.orderNumber} has been cancelled`,
        type: 'order_cancelled',
      },
    };
    const notif = notifMap[savedOrder.status];
    if (notif) {
      // Cancellation: notify the side that did NOT cancel.
      // All other transitions are manufacturer-driven → notify clinic.
      let recipientOrgId: string | undefined;
      if (savedOrder.status === OrderStatus.CANCELLED) {
        recipientOrgId =
          isClinicCallerOwningOrder && !isManufacturer ? mfgOrgId : clinicOrgId;
      } else {
        recipientOrgId = clinicOrgId;
      }
      if (recipientOrgId) {
        this.orgUserRepository
          .find({ where: { organisationId: recipientOrgId, role: In(['OWNER', 'MANAGER', 'ADMIN']), isActive: true } })
          .then((orgUsers) => {
            const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
            if (userIds.length > 0) {
              this.notificationsService.sendToUsers({
                userIds,
                title: notif.title,
                body: notif.body,
                data: { orderId: savedOrder.id, type: notif.type },
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }
    }

    return savedOrder;
  }

  private static readonly AYURLAHI_TEAM_ORG_ID = '00000000-0000-0000-0000-000000000001';

  /**
   * Ayurlahi-managed fulfillment: assign a Team Ayurlahi member to collect
   * this item from the manufacturer. Assignment is distinct from pickup —
   * see markItemPickedUp. Gated the same way updateStatus is (admin/support
   * only); no new permission model.
   */
  async assignOrderItem(
    orderId: string,
    itemId: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    organisationId: string | undefined,
    dto: AssignOrderItemDto,
  ) {
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException('Only Ayurlahi Team admin/support can assign order pickups');
    }

    const order = await this.findOne(orderId, userId, userRole, organisationType, organisationId);
    const item = order.items?.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Order item ${itemId} not found on order ${orderId}`);
    }

    // The assignee must actually be a Team Ayurlahi member — not just any user id.
    const assigneeMembership = await this.orgUserRepository.findOne({
      where: { userId: dto.userId, organisationId: OrdersService.AYURLAHI_TEAM_ORG_ID, isActive: true },
    });
    if (!assigneeMembership) {
      throw new BadRequestException('Assigned user is not an active Team Ayurlahi member');
    }

    item.assignedUserId = dto.userId;
    const saved = await this.orderItemsRepository.save(item);

    this.notificationsService.sendToUsers({
      userIds: [dto.userId],
      title: 'Pickup Assigned',
      body: `You've been assigned to collect ${item.productName} (order ${order.orderNumber}) from the manufacturer`,
      data: { orderId, itemId, type: 'pickup_assigned' },
    }).catch(() => {});

    return saved;
  }

  /**
   * Ayurlahi-managed fulfillment: record that the assigned Team Ayurlahi
   * member has physically collected this item from the manufacturer.
   * The order-level status transition to SHIPPED is delegated to the
   * existing updateStatus() so the clinic gets the same "Order Shipped"
   * notification and state-machine validation it already gets today —
   * this does not set `status` directly, and does not fire that
   * notification a second time if the order is already SHIPPED/DELIVERED
   * (relevant once a single order can have multiple items/pickups).
   */
  async markItemPickedUp(
    orderId: string,
    itemId: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    organisationId: string | undefined,
  ) {
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException('Only Ayurlahi Team admin/support can mark an item picked up');
    }

    const order = await this.findOne(orderId, userId, userRole, organisationType, organisationId);
    const item = order.items?.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Order item ${itemId} not found on order ${orderId}`);
    }
    if (!item.assignedUserId) {
      throw new BadRequestException('Assign a Team Ayurlahi member before marking this item picked up');
    }
    if (item.pickedUpAt) {
      throw new BadRequestException('This item has already been marked picked up');
    }

    item.pickedUpAt = new Date();
    item.status = OrderItemStatus.SHIPPED;
    await this.orderItemsRepository.save(item);

    if (order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.DELIVERED) {
      await this.updateStatus(
        orderId,
        userId,
        userRole,
        organisationType,
        { status: OrderStatus.SHIPPED },
        organisationId,
      );
    }

    return this.orderItemsRepository.findOne({ where: { id: itemId } });
  }

  /**
   * Create an invoice row when an order is marked delivered.
   * PDF rendering + S3 upload is deferred (V7) — when wired, the s3Key/s3Url
   * fields can be populated by a separate worker that picks up invoices
   * with empty s3Key.
   */
  private async createInvoiceForDeliveredOrder(order: Order): Promise<void> {
    // Don't duplicate if already exists
    const existing = await this.invoicesRepository.findOne({ where: { orderId: order.id } });
    if (existing) return;

    const items = (order.items || []).map((i) => ({
      productId: i.productId,
      productSku: i.productSku,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      mrp: i.mrp != null ? Number(i.mrp) : null,
      hsnCode: i.hsnCode || null,
      totalPrice: Number(i.unitPrice) * i.quantity,
    }));
    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
    // Sum each item's real snapshotted GST amount rather than assuming a flat
    // rate — some PMS products (P Kof, Iro Forte, Immuno Forte) are 18%, not 5%.
    const gstAmount = (order.items || []).reduce((sum, i) => sum + Number(i.gstAmount), 0);
    const totalAmount = subtotal + gstAmount;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${order.orderNumber}`;
    const manufacturerId = order.items?.[0]?.manufacturerId;

    const [clinicOrgDetails, manufacturerDetails] = await Promise.all([
      this.getClinicOrgDetails(order.organisationId),
      manufacturerId ? this.getManufacturerInvoiceDetails(manufacturerId) : Promise.resolve(null),
    ]);

    // The "Billed To" address must reflect the branch this specific order
    // actually shipped to/from — different branches can sit in different
    // states, which affects tax treatment, not just display. order.shippingAddress
    // is the correct per-order source (captured once at checkout, carried
    // through reorder()); only fall back to the org's primary branch for the
    // rare order with no shippingAddress at all (optional at the DTO level
    // even though the UI requires it). Never re-derive this from the org's
    // *current* primary branch on every read — it's snapshotted once here, at
    // invoice creation, same as clinicOrgDetails/manufacturerDetails, so a
    // later branch-address edit can't silently rewrite a past invoice.
    const shippingAddr = order.shippingAddress as any;
    const hasShippingAddress = !!(shippingAddr?.line1 && shippingAddr?.city);
    const clinicAddress = hasShippingAddress
      ? {
          address: shippingAddr.line1 ?? null,
          city: shippingAddr.city ?? null,
          state: shippingAddr.state ?? null,
          pincode: shippingAddr.pincode ?? null,
          phone: shippingAddr.phone ?? null,
        }
      : await this.getClinicPrimaryBranchAddress(order.organisationId);

    const invoice = this.invoicesRepository.create({
      orderId: order.id,
      invoiceNumber,
      s3Key: '', // populated when S3 worker generates PDF
      s3Url: '',
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
      clinicDetails: {
        organisationId: order.organisationId,
        shippingAddress: order.shippingAddress,
        ...clinicOrgDetails,
        ...clinicAddress,
      },
      manufacturerDetails,
      items,
      subtotal,
      gstAmount,
      shippingCharges: 0,
      platformFee: 0,
      totalAmount,
      isGstInvoice: true,
      hsnCode: null,
    });
    try {
      await this.invoicesRepository.save(invoice);
    } catch (err: any) {
      // Don't fail the order delivery if invoice creation hits a constraint;
      // log and continue. Accountants can regenerate via separate flow.
      console.error('[OrdersService] Failed to create invoice for order', order.id, err?.message);
    }
  }

  // organisations has no gstin column — that lives on clinic_profiles. Looked
  // up by string table name since ClinicProfile isn't registered in
  // OrdersModule (same pattern ClinicsService uses for 'branches').
  private async getClinicOrgDetails(organisationId: string): Promise<Record<string, any>> {
    const manager = this.ordersRepository.manager;
    const [org, profile] = await Promise.all([
      manager.getRepository('organisations').findOne({ where: { id: organisationId } }) as Promise<any>,
      manager.getRepository('clinic_profiles').findOne({ where: { organisationId } }) as Promise<any>,
    ]);
    return {
      name: org?.name ?? null,
      gstin: profile?.gstin ?? null,
    };
  }

  // Fallback only, for the rare order with no shippingAddress captured at all
  // — see the comment above this method's call site in
  // createInvoiceForDeliveredOrder(). Do not use this as the primary address
  // source; a clinic's primary branch is not necessarily the branch a given
  // order was actually for.
  private async getClinicPrimaryBranchAddress(organisationId: string): Promise<Record<string, any>> {
    const branch = await this.ordersRepository.manager
      .getRepository('branches')
      .createQueryBuilder('branch')
      .where('branch.organisation_id = :orgId', { orgId: organisationId })
      .andWhere('branch.deleted_at IS NULL')
      .andWhere('branch.is_active = true')
      .orderBy('branch.is_primary', 'DESC')
      .addOrderBy('branch.created_at', 'ASC')
      .getOne() as any;
    return {
      address: branch?.address ?? null,
      city: branch?.city ?? null,
      state: branch?.state ?? null,
      pincode: branch?.pincode ?? null,
      phone: branch?.phone ?? null,
    };
  }

  private async getManufacturerInvoiceDetails(manufacturerId: string): Promise<Record<string, any>> {
    const manager = this.ordersRepository.manager;
    const [org, profile] = await Promise.all([
      manager.getRepository('organisations').findOne({ where: { id: manufacturerId } }) as Promise<any>,
      manager.getRepository('manufacturer_profiles').findOne({ where: { organisationId: manufacturerId } }) as Promise<any>,
    ]);
    return {
      name: profile?.companyName ?? org?.name ?? null,
      gstin: profile?.gstin ?? null,
      address: profile?.address ?? null,
      city: profile?.city ?? null,
      state: profile?.state ?? null,
      pincode: profile?.pincode ?? null,
      phone: profile?.phone ?? null,
    };
  }
}
