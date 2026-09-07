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
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { UpdateOrderItemQuantityDto } from './dto/update-order-item-quantity.dto';
import { CreateExternalOrderDto } from './dto/create-external-order.dto';
import { GrantExternalOrderAccessDto } from './dto/grant-external-order-access.dto';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RoleUtils } from '../common/utils/role.utils';
import { Invoice } from '../invoices/entities/invoice.entity';
import { OrderReplacement, ReplacementReason, ReplacementStatus } from './entities/order-replacement.entity';
import { CreateReplacementDto } from './dto/create-replacement.dto';
import { Dispute, DisputeStatus } from '../disputes/entities/dispute.entity';

// Valid order status transitions. Anything not in the allowed set is rejected.
// PACKED sits between PROCESSING and SHIPPED (§10 of
// scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md) -- the direct
// CONFIRMED -> SHIPPED skip-ahead that existed before this step is dropped:
// it belonged to a world where nothing meaningful happened during packing,
// which is no longer true once partial fulfillment/billing hang off PACKED.
// Packing quantities, billing-on-PACKED, and everything else PACKED will
// eventually gate are separate, later steps -- this step only adds the
// status itself and its transition edges.
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
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
    @InjectRepository(OrderReplacement)
    private orderReplacementsRepository: Repository<OrderReplacement>,
    @InjectRepository(Dispute)
    private disputesRepository: Repository<Dispute>,
    private inventoryService: InventoryService,
    private notificationsService: NotificationsService,
  ) { }

  // Order.organisationId is a plain FK (no ORM relation defined on the
  // entity), and the clinic's name is never otherwise present anywhere in
  // an order response -- a manufacturer looking at an order (list or
  // detail) had no way to see which clinic it was even for. Batched here
  // rather than a relation/join so both findAll (many orders, possibly many
  // different clinics) and findOne (one) share the same lookup, matching
  // the existing string-based getRepository('organisations') pattern
  // already used in create()/createInvoiceForPackedOrder() in this file.
  private async attachClinicNames<T extends { organisationId: string }>(orders: T[]): Promise<(T & { clinicName: string | null })[]> {
    const ids = [...new Set(orders.map((o) => o.organisationId))];
    if (ids.length === 0) return orders as (T & { clinicName: string | null })[];
    const orgs = (await this.ordersRepository.manager
      .getRepository('organisations')
      .find({ where: { id: In(ids) }, select: ['id', 'name'] })) as { id: string; name: string }[];
    const nameById = new Map(orgs.map((o) => [o.id, o.name]));
    return orders.map((o) => Object.assign(o, { clinicName: nameById.get(o.organisationId) ?? null }));
  }

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
    // OrderItem.deletedAt is a plain column, not a TypeORM @DeleteDateColumn
    // (unlike Order's own deletedAt) -- so it's never auto-excluded by the
    // ORM. An item removed via an amendment (§6/Step 5) must not resurface
    // here. Filtered in JS rather than in the query builder to avoid
    // disturbing the existing per-org item-scoping already happening above
    // (MANUFACTURER callers get the WHERE-filtered join at line 85).
    data.forEach((o) => { o.items = (o.items || []).filter((i) => !i.deletedAt); });
    // Mutates each order in place (Object.assign) -- `data` already carries
    // clinicName once this resolves.
    await this.attachClinicNames(data);

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

    // Same reasoning as findAll(): OrderItem.deletedAt is not a TypeORM
    // @DeleteDateColumn, so a removed item (§6/Step 5) needs an explicit
    // filter here too.
    order.items = (order.items || []).filter((i) => !i.deletedAt);
    // Mutates order in place (Object.assign) -- the plain `return order`
    // below already carries clinicName once this resolves.
    await this.attachClinicNames([order]);

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
          // Group by organisation — an order can span multiple manufacturers,
          // and each notification must carry its own recipient's org so
          // tapping it switches to the right context, not just any of them.
          const byOrg = new Map<string, string[]>();
          for (const ou of orgUsers) {
            if (!ou.userId) continue;
            const list = byOrg.get(ou.organisationId) ?? [];
            list.push(ou.userId);
            byOrg.set(ou.organisationId, list);
          }
          for (const [mfgOrgId, userIds] of byOrg) {
            this.notificationsService.sendToUsers({
              userIds,
              title: 'New Order Received',
              body: `Order ${orderWithRelations?.orderNumber}: ${itemSummary}`,
              data: { orderId: savedOrder.id, type: 'order_placed', organisationId: mfgOrgId },
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
            data: { orderId: savedOrder.id, type: 'order_needs_fulfillment', organisationId: OrdersService.AYURLAHI_TEAM_ORG_ID },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return orderWithRelations;
  }

  /**
   * Shared by create() and createExternalOrder(): validates, pessimistic-locks,
   * and reserves stock for a set of items inside a transaction, then builds
   * the OrderItem snapshots (price/MRP/HSN/GST/commission) from the
   * locked-and-reserved products.
   *
   * Reservation is capped to whatever stock is actually available, not
   * rejected when insufficient — `quantity` (what the clinic/manufacturer
   * requested) is never reduced; `reservedQuantity` (what was actually able
   * to be committed right now, persisted on OrderItem) can land lower, down
   * to 0. Money/GST/commission below still derive from the requested
   * `quantity`, unchanged from before this reservation change — the actual
   * packed/billed quantity is a separate, later concern (see
   * scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §7, not this step).
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
    type ProductWithItem = { product: Product; itemDto: (typeof items)[0]; reservedQuantity: number };
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
        if (item.quantity < product.minOrderQuantity) {
          throw new BadRequestException(
            `Minimum order quantity for ${product.name} is ${product.minOrderQuantity}`,
          );
        }

        // Reservation is capped to what's actually available, never rejected
        // outright — partial fulfillment is expected, not an error (see
        // scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §2.2/§5).
        // This intentionally allows reservedQuantity to land at 0 when
        // nothing is currently in stock: the prior all-or-nothing check
        // above applied the exact same rejection whether stock was fully
        // insufficient or just short by one unit, so there is no existing
        // precedent for treating "zero available" as a distinct, harder
        // failure than "partially available" — both are the same shortfall,
        // just at different magnitudes. The separate `status !== 'active'`
        // check above (a manufacturer-controlled flag, never set
        // automatically by stock level — confirmed nothing in this codebase
        // writes ProductStatus.OUT_OF_STOCK) remains the actual mechanism
        // for a manufacturer to hard-block ordering a specific product;
        // stock quantity alone no longer does that job.
        const reservedQuantity = Math.min(item.quantity, product.stockQuantity);

        // Decrement inside the transaction while the row is locked
        if (reservedQuantity > 0) {
          await productRepo.decrement({ id: product.id }, 'stockQuantity', reservedQuantity);
          product.stockQuantity -= reservedQuantity;
        }
        products.push({ product, itemDto: item, reservedQuantity });
      }
    });

    let subtotal = 0;
    let totalGstAmount = 0;
    const orderItems: Partial<OrderItem>[] = [];

    for (const { product, itemDto, reservedQuantity } of products) {
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
        reservedQuantity,
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

    // Persist an optional transition note (e.g. "2 units unavailable, will
    // follow up separately") for every status except CANCELLED, which
    // already has its own dedicated cancellationReason below. Append rather
    // than overwrite — order.notes already carries the clinic's own note
    // from order creation, so blindly assigning here would silently destroy
    // that the first time a manufacturer adds one. This is a communication
    // patch only — it does not represent structured packing/shortage data.
    if (updateDto.status !== OrderStatus.CANCELLED && updateDto.notes?.trim()) {
      const transitionNote = `${updateDto.status} update: ${updateDto.notes.trim()}`;
      order.notes = order.notes ? `${order.notes}\n\n---\n${transitionNote}` : transitionNote;
    }

    // Update timestamps based on status
    if (updateDto.status === OrderStatus.CONFIRMED && !order.confirmedAt) {
      order.confirmedAt = new Date();
    } else if (
      updateDto.status === OrderStatus.PACKED &&
      !order.packedAt
    ) {
      order.packedAt = new Date();

      // Record what was actually packed per item (defaults to
      // reservedQuantity -- the common case, everything reserved got
      // packed) and any per-item discount. This is not the packing UI and
      // not an amendment -- it only records the outcome of packing for
      // items that already exist on the order. See
      // scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §7.
      if (order.items && order.items.length > 0) {
        const providedIds = new Set((updateDto.items || []).map((i) => i.orderItemId));
        const realIds = new Set(order.items.map((i) => i.id));
        for (const providedId of providedIds) {
          if (!realIds.has(providedId)) {
            throw new BadRequestException(`Order item ${providedId} does not belong to this order`);
          }
        }
        const packedInputById = new Map((updateDto.items || []).map((i) => [i.orderItemId, i]));

        for (const item of order.items) {
          const input = packedInputById.get(item.id);

          // packedQuantity can never exceed reservedQuantity -- packing
          // can't physically produce more than was reserved. Omitting it
          // defaults to "everything reserved got packed"; an explicit lower
          // value is the only way it lands below reservedQuantity (e.g. a
          // reserved unit failed a quality check during packing).
          const requestedPacked = input?.packedQuantity ?? item.reservedQuantity;
          const packedQuantity = Math.min(requestedPacked, item.reservedQuantity);

          // Reserved-but-never-packed: release back to stock now, same
          // mechanism already used for cancellation restoration (§5/§6 of
          // the scope doc) -- this is the reconciliation that section
          // explicitly deferred until PACKED existed.
          const toRelease = item.reservedQuantity - packedQuantity;
          if (toRelease > 0) {
            await this.productsRepository.increment({ id: item.productId }, 'stockQuantity', toRelease);
          }

          item.packedQuantity = packedQuantity;
          item.discountAmount = input?.discountAmount ?? Number(item.discountAmount) ?? 0;
        }

        order.discountAmount = order.items.reduce((sum, i) => sum + (Number(i.discountAmount) || 0), 0);
      }

      // Billing now happens here, not on DELIVERED -- packing is the
      // checkpoint quantities and money are frozen at (§7). Renamed from
      // createInvoiceForDeliveredOrder to reflect the new trigger.
      await this.createInvoiceForPackedOrder(order);
    } else if (updateDto.status === OrderStatus.SHIPPED && !order.shippedAt) {
      order.shippedAt = new Date();
    } else if (
      updateDto.status === OrderStatus.DELIVERED &&
      !order.deliveredAt
    ) {
      order.deliveredAt = new Date();
      // Sync Inventory -- credits the clinic's own stock with what was
      // actually packed/shipped, not the originally requested quantity.
      // Judgment call made in the same step as the billing relocation this
      // sits right next to, since it's the exact same quantity-source bug
      // (§4 of the scope doc groups this with billing under "the
      // actual-supplied field" fix) -- flagged explicitly in this step's
      // report rather than silently bundled in.
      if (order.items && order.items.length > 0) {
        const deliveredItems = order.items.filter((item) => item.packedQuantity > 0);
        if (deliveredItems.length > 0) {
          await this.inventoryService.addStock(
            order.organisationId,
            deliveredItems.map((item) => ({
              productId: item.productId,
              sku: item.productSku,
              name: item.productName,
              quantity: item.packedQuantity,
              unitPrice: Number(item.unitPrice),
              orderId: order.id,
            })),
          );
        }
      }
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
      //
      // Restore reservedQuantity, not quantity: since reservation now caps to
      // whatever was actually available at order-creation time (see
      // lockAndSnapshotOrderItems), what was actually taken from
      // products.stockQuantity for a short-supplied item is less than the
      // clinic's original request. Restoring the full `quantity` here would
      // hand back stock that was never actually reserved in the first place —
      // silently inflating stockQuantity beyond what this order ever held.
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          if (item.reservedQuantity > 0) {
            await this.productsRepository.increment({ id: item.productId }, 'stockQuantity', item.reservedQuantity);
          }
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
                data: { orderId: savedOrder.id, type: notif.type, organisationId: recipientOrgId },
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
      data: { orderId, itemId, type: 'pickup_assigned', organisationId: OrdersService.AYURLAHI_TEAM_ORG_ID },
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
   * Shared guard for all three amendment methods below (add/remove/change-
   * quantity). Amendments are manufacturer/admin-support only -- never the
   * clinic, even for their own order (the confirmed real-world scenario is
   * the clinic phoning the manufacturer, who enters the change; matches
   * updateStatus()'s isManufacturer||isAdmin gate, not its separate,
   * narrower clinic-cancel-only path) -- and only before PACKED, the same
   * checkpoint billing uses. Once PACKED, an amendment would silently
   * corrupt or bypass the already-created invoice (see
   * scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §6's correction).
   */
  private assertCanAmend(order: Order, userRole: string, organisationType: string | undefined): void {
    const normalizedRole = RoleUtils.normalizeRole(userRole, organisationType);
    const isManufacturer = normalizedRole === 'manufacturer';
    const isAdmin = ['admin', 'support'].includes(normalizedRole);
    if (!(isManufacturer || isAdmin)) {
      throw new ForbiddenException('Only the manufacturer or Ayurlahi Team admin/support can amend an order');
    }
    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING].includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be amended once status is "${order.status}" — amendments are only allowed before packing.`,
      );
    }
  }

  // Append-only audit trail for amendments, piggybacking on the existing
  // orders.metadata jsonb column rather than a new table/column -- the
  // scope doc's §6 left this as an implementation-time choice; a dedicated
  // table would just be tracking the same handful of fields a jsonb array
  // already represents fine for this volume.
  private appendAmendmentAudit(order: Order, userId: string, entry: Record<string, any>): void {
    const metadata = (order.metadata as Record<string, any>) || {};
    const amendments = Array.isArray(metadata.amendments) ? metadata.amendments : [];
    amendments.push({ at: new Date().toISOString(), byUserId: userId, ...entry });
    order.metadata = { ...metadata, amendments };
  }

  // Order-level subtotal/gstAmount/totalAmount are an aggregate snapshot
  // (same fields create() sets once) -- any amendment that changes which
  // items exist or their quantity must recompute them, or the order total
  // silently drifts from the sum of its own items.
  private recomputeOrderAggregates(order: Order): void {
    const activeItems = (order.items || []).filter((i) => !i.deletedAt);
    order.subtotal = activeItems.reduce((sum, i) => sum + Number(i.subtotal), 0);
    order.gstAmount = activeItems.reduce((sum, i) => sum + Number(i.gstAmount), 0);
    order.totalAmount = order.subtotal + order.gstAmount + Number(order.shippingCharges || 0) + Number(order.platformFee || 0);
  }

  /**
   * Amendment: add a new line to an order still being packed. Runs the same
   * cap-to-available reservation logic as order creation
   * (lockAndSnapshotOrderItems), just for one item -- duplicated rather than
   * shared with that method to keep this already-large step's diff
   * isolated and avoid touching already-verified Step 1-4 code.
   */
  async addOrderItem(
    orderId: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    organisationId: string | undefined,
    dto: AddOrderItemDto,
  ): Promise<Order> {
    const order = await this.findOne(orderId, userId, userRole, organisationType, organisationId);
    this.assertCanAmend(order, userRole, organisationType);

    let newItem: OrderItem | null = null;
    await this.productsRepository.manager.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const product = await productRepo.findOne({
        where: { id: dto.productId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${dto.productId} not found`);
      }
      // A manufacturer can only add their own products -- assertCanAmend()
      // only confirms the caller is *a* manufacturer associated with this
      // order via some existing item, not that they own the specific
      // product being added. Without this, any manufacturer on the order
      // could add a different manufacturer's product to someone else's
      // order. Admin/support are exempt (matches every other admin-bypass
      // check in this service).
      const normalizedRole = RoleUtils.normalizeRole(userRole, organisationType);
      const isAdmin = ['admin', 'support'].includes(normalizedRole);
      if (!isAdmin && product.manufacturerId !== organisationId) {
        throw new ForbiddenException('You can only add your own products to an order');
      }
      if (product.status !== 'active') {
        throw new BadRequestException(`Product ${product.name} is not active`);
      }
      if (dto.quantity < product.minOrderQuantity) {
        throw new BadRequestException(`Minimum order quantity for ${product.name} is ${product.minOrderQuantity}`);
      }

      // Reserve independently of every other item already on this order —
      // capped to what's currently available, never rejected outright, same
      // as order creation.
      const reservedQuantity = Math.min(dto.quantity, product.stockQuantity);
      if (reservedQuantity > 0) {
        await productRepo.decrement({ id: product.id }, 'stockQuantity', reservedQuantity);
      }

      const unitPrice = Number(product.price);
      const itemSubtotal = unitPrice * dto.quantity;
      const itemGstAmount = (itemSubtotal * Number(product.gstRate)) / 100;
      const itemTotal = itemSubtotal + itemGstAmount;
      const commissionAmount = (itemTotal * 0.05) / 100;

      newItem = {
        orderId: order.id,
        productId: product.id,
        manufacturerId: product.manufacturerId,
        productSku: product.sku,
        productName: product.name,
        quantity: dto.quantity,
        reservedQuantity,
        unitPrice,
        mrp: product.mrp != null ? Number(product.mrp) : null,
        hsnCode: product.hsnCode || null,
        gstRate: Number(product.gstRate),
        subtotal: itemSubtotal,
        gstAmount: itemGstAmount,
        totalAmount: itemTotal,
        commissionAmount,
        packedQuantity: 0,
        discountAmount: 0,
        notes: dto.notes || null,
      } as OrderItem;
    });

    // newItem is always set before the transaction completes without
    // throwing -- if it threw, this line is never reached.
    order.items = [...(order.items || []), newItem!];
    this.recomputeOrderAggregates(order);
    this.appendAmendmentAudit(order, userId, {
      type: 'add_item',
      productId: dto.productId,
      productName: newItem!.productName,
      quantity: dto.quantity,
      reservedQuantity: newItem!.reservedQuantity,
    });

    await this.ordersRepository.save(order);
    return this.findOne(orderId, userId, userRole, organisationType, organisationId);
  }

  /**
   * Amendment: remove a line from an order still being packed. Releases
   * whatever was reserved for it back to products.stockQuantity — a plain
   * .increment() with no explicit lock, same as the existing cancellation-
   * restore path, since an increment is a single atomic UPDATE and doesn't
   * need read-then-decide-then-write the way capping a new reservation does.
   */
  async removeOrderItem(
    orderId: string,
    itemId: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    organisationId: string | undefined,
  ): Promise<Order> {
    const order = await this.findOne(orderId, userId, userRole, organisationType, organisationId);
    this.assertCanAmend(order, userRole, organisationType);

    const item = order.items?.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Order item ${itemId} not found on order ${orderId}`);
    }
    if ((order.items || []).length <= 1) {
      throw new BadRequestException('Cannot remove the only item on an order — cancel the order instead.');
    }

    if (item.reservedQuantity > 0) {
      await this.productsRepository.increment({ id: item.productId }, 'stockQuantity', item.reservedQuantity);
    }

    // Soft delete (OrderItem.deletedAt is a plain column, not a TypeORM
    // @DeleteDateColumn — see findOne()/findAll()). Must be saved explicitly
    // here: once removed from order.items below, the cascade save on
    // ordersRepository.save(order) will no longer touch this row at all
    // (TypeORM's default cascade does not delete/update orphaned children).
    item.deletedAt = new Date();
    await this.orderItemsRepository.save(item);

    order.items = (order.items || []).filter((i) => i.id !== itemId);
    this.recomputeOrderAggregates(order);
    this.appendAmendmentAudit(order, userId, {
      type: 'remove_item',
      orderItemId: itemId,
      productId: item.productId,
      productName: item.productName,
      releasedQuantity: item.reservedQuantity,
    });

    await this.ordersRepository.save(order);
    return this.findOne(orderId, userId, userRole, organisationType, organisationId);
  }

  /**
   * Amendment: change the requested quantity of an existing line, before
   * PACKED. Reservation is recomputed against current stock, capped to
   * whatever's available, never rejected outright — see the reservation
   * table worked out in scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md
   * §19 before this was implemented: availableForThisItem = current free
   * stock + whatever this item already holds (since that's being
   * re-evaluated, not necessarily kept). unitPrice/gstRate are NOT
   * re-snapshotted from the product's current catalog price — an amendment
   * to quantity is not a re-price, only the money derived from quantity
   * changes.
   */
  async updateOrderItemQuantity(
    orderId: string,
    itemId: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    organisationId: string | undefined,
    dto: UpdateOrderItemQuantityDto,
  ): Promise<Order> {
    const order = await this.findOne(orderId, userId, userRole, organisationType, organisationId);
    this.assertCanAmend(order, userRole, organisationType);

    const item = order.items?.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Order item ${itemId} not found on order ${orderId}`);
    }

    const oldQuantity = item.quantity;
    const oldReserved = item.reservedQuantity;
    let newReserved = 0;

    await this.productsRepository.manager.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const product = await productRepo.findOne({
        where: { id: item.productId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${item.productId} not found`);
      }
      if (dto.quantity < product.minOrderQuantity) {
        throw new BadRequestException(`Minimum order quantity for ${product.name} is ${product.minOrderQuantity}`);
      }

      // Pool available to (re)allocate to THIS item: currently-free stock,
      // plus whatever this item already holds (its current reservation is
      // being re-evaluated against the new requested quantity, not kept
      // as-is by default).
      const availableForThisItem = product.stockQuantity + oldReserved;
      newReserved = Math.min(dto.quantity, availableForThisItem);
      const delta = oldReserved - newReserved;
      if (delta > 0) {
        // Requested quantity went down (or availability shrank) — release
        // the difference back to the pool.
        await productRepo.increment({ id: product.id }, 'stockQuantity', delta);
      } else if (delta < 0) {
        // Requested quantity went up and more became available since this
        // item was last reserved — take the difference. Safe by
        // construction: newReserved <= availableForThisItem =
        // product.stockQuantity + oldReserved, so -delta = newReserved -
        // oldReserved <= product.stockQuantity — can never go negative.
        await productRepo.decrement({ id: product.id }, 'stockQuantity', -delta);
      }
    });

    const itemSubtotal = Number(item.unitPrice) * dto.quantity;
    const itemGstAmount = (itemSubtotal * Number(item.gstRate)) / 100;
    const itemTotal = itemSubtotal + itemGstAmount;
    const commissionAmount = (itemTotal * 0.05) / 100;

    item.quantity = dto.quantity;
    item.reservedQuantity = newReserved;
    item.subtotal = itemSubtotal;
    item.gstAmount = itemGstAmount;
    item.totalAmount = itemTotal;
    item.commissionAmount = commissionAmount;

    this.recomputeOrderAggregates(order);
    this.appendAmendmentAudit(order, userId, {
      type: 'update_quantity',
      orderItemId: itemId,
      productId: item.productId,
      productName: item.productName,
      beforeQuantity: oldQuantity,
      afterQuantity: dto.quantity,
      beforeReserved: oldReserved,
      afterReserved: newReserved,
    });

    await this.ordersRepository.save(order);
    return this.findOne(orderId, userId, userRole, organisationType, organisationId);
  }

  // Shared tenant check for all three replacement methods: the clinic that
  // owns the order, the manufacturer associated with it (has at least one
  // item), or admin/support. Mirrors the access pattern already used in
  // findOne() above and (now) disputes.service.ts's own findOne().
  private assertCanAccessOrderForReplacement(
    order: Order,
    organisationType: string | undefined,
    organisationId: string | undefined,
  ): { isClinic: boolean; isManufacturer: boolean; isAdmin: boolean } {
    const isAdmin = organisationType === 'AYURLAHI_TEAM';
    const isClinic = organisationType === 'CLINIC' && !!organisationId && order.organisationId === organisationId;
    const isManufacturer =
      organisationType === 'MANUFACTURER' &&
      !!organisationId &&
      (order.items || []).some((item) => item.manufacturerId === organisationId);

    if (!(isAdmin || isClinic || isManufacturer)) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return { isClinic, isManufacturer, isAdmin };
  }

  /**
   * Post-delivery discrepancy report (missing/wrong/damaged item) — raised
   * by the clinic that owns the order, against a specific already-
   * delivered item. Always a $0 correction against the original order;
   * never a new order or invoice (§9 of
   * scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md). Stock is not
   * touched here — only when the replacement actually ships
   * (shipReplacement), matching the locked design's
   * "created -> shipped -> resolved" sequence.
   */
  async createReplacement(
    orderId: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    organisationId: string | undefined,
    dto: CreateReplacementDto,
  ): Promise<OrderReplacement> {
    const order = await this.findOne(orderId, userId, userRole, organisationType, organisationId);
    const normalizedRole = RoleUtils.normalizeRole(userRole, organisationType);
    const isAdmin = ['admin', 'support'].includes(normalizedRole);
    const isClinicOwner = organisationType === 'CLINIC' && !!organisationId && order.organisationId === organisationId;
    if (!(isClinicOwner || isAdmin)) {
      throw new ForbiddenException('Only the clinic that placed this order (or Ayurlahi Team admin/support) can report a replacement');
    }

    // Replacement is a post-delivery concept -- the locked business rule is
    // explicitly "post-delivery discrepancy", not "anything at any stage".
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(`Replacements can only be reported once an order is delivered (current status: "${order.status}")`);
    }

    const item = order.items?.find((i) => i.id === dto.orderItemId);
    if (!item) {
      throw new NotFoundException(`Order item ${dto.orderItemId} not found on order ${orderId}`);
    }

    if (dto.disputeId) {
      const dispute = await this.disputesRepository.findOne({ where: { id: dto.disputeId, deletedAt: IsNull() } });
      if (!dispute || dispute.orderId !== orderId) {
        throw new BadRequestException('disputeId must reference an existing dispute on this same order');
      }
    }

    // Cap against what was actually delivered, cumulative across every
    // prior replacement already raised for this item -- a unit can't be
    // replaced twice over. packedQuantity is the best available "what did
    // this clinic actually get" signal today: shippedQuantity/
    // deliveredQuantity remain deliberately dormant (§11) -- wiring them is
    // not this step's job.
    const priorReplacements = await this.orderReplacementsRepository.find({
      where: { orderItemId: item.id, deletedAt: IsNull() },
    });
    const alreadyReplaced = priorReplacements.reduce((sum, r) => sum + r.quantity, 0);
    const remaining = item.packedQuantity - alreadyReplaced;
    if (dto.quantity > remaining) {
      throw new BadRequestException(
        `Cannot replace ${dto.quantity} units — only ${remaining} of ${item.packedQuantity} delivered units on this line remain un-replaced.`,
      );
    }

    const replacement = this.orderReplacementsRepository.create({
      organisationId: order.organisationId,
      orderId: order.id,
      orderItemId: item.id,
      disputeId: dto.disputeId || null,
      quantity: dto.quantity,
      reason: dto.reason,
      charge: 0,
      status: ReplacementStatus.PENDING,
      createdBy: userId,
    });
    return this.orderReplacementsRepository.save(replacement);
  }

  /** List replacements for an order — same tenant access as the order itself. */
  async listReplacements(
    orderId: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    organisationId: string | undefined,
  ): Promise<OrderReplacement[]> {
    const order = await this.findOne(orderId, userId, userRole, organisationType, organisationId);
    this.assertCanAccessOrderForReplacement(order, organisationType, organisationId);
    return this.orderReplacementsRepository.find({
      where: { orderId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Ship a replacement -- the manufacturer associated with the order (or
   * admin/support) physically sends the replacement unit(s). This is the
   * moment stock actually moves: decrements products.stockQuantity by the
   * replacement quantity, same as any other unit leaving the warehouse. Not
   * capped/rejected on insufficient stock -- unlike a normal order
   * reservation, a replacement is an obligatory correction for the
   * manufacturer's own error, not a fresh sale subject to availability.
   */
  async shipReplacement(
    orderId: string,
    replacementId: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    organisationId: string | undefined,
  ): Promise<OrderReplacement> {
    const order = await this.findOne(orderId, userId, userRole, organisationType, organisationId);
    const { isManufacturer, isAdmin } = this.assertCanAccessOrderForReplacement(order, organisationType, organisationId);
    if (!(isManufacturer || isAdmin)) {
      throw new ForbiddenException('Only the manufacturer associated with this order (or Ayurlahi Team admin/support) can ship a replacement');
    }

    const replacement = await this.orderReplacementsRepository.findOne({ where: { id: replacementId, orderId, deletedAt: IsNull() } });
    if (!replacement) {
      throw new NotFoundException(`Replacement ${replacementId} not found on order ${orderId}`);
    }
    if (replacement.status !== ReplacementStatus.PENDING) {
      throw new BadRequestException(`Replacement cannot be shipped from status "${replacement.status}"`);
    }

    const item = order.items?.find((i) => i.id === replacement.orderItemId);
    if (item) {
      await this.productsRepository.decrement({ id: item.productId }, 'stockQuantity', replacement.quantity);
    }

    replacement.status = ReplacementStatus.SHIPPED;
    return this.orderReplacementsRepository.save(replacement);
  }

  /**
   * Resolve a replacement (delivered/acknowledged) — no further stock or
   * money effect. Also resolves the linked dispute, if one exists, so the
   * human-facing case and the mechanical fulfillment record close together.
   */
  async resolveReplacement(
    orderId: string,
    replacementId: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    organisationId: string | undefined,
  ): Promise<OrderReplacement> {
    const order = await this.findOne(orderId, userId, userRole, organisationType, organisationId);
    const { isManufacturer, isAdmin } = this.assertCanAccessOrderForReplacement(order, organisationType, organisationId);
    if (!(isManufacturer || isAdmin)) {
      throw new ForbiddenException('Only the manufacturer associated with this order (or Ayurlahi Team admin/support) can resolve a replacement');
    }

    const replacement = await this.orderReplacementsRepository.findOne({ where: { id: replacementId, orderId, deletedAt: IsNull() } });
    if (!replacement) {
      throw new NotFoundException(`Replacement ${replacementId} not found on order ${orderId}`);
    }
    if (replacement.status !== ReplacementStatus.SHIPPED) {
      throw new BadRequestException(`Replacement cannot be resolved from status "${replacement.status}"`);
    }

    replacement.status = ReplacementStatus.RESOLVED;
    replacement.resolvedAt = new Date();
    const saved = await this.orderReplacementsRepository.save(replacement);

    if (replacement.disputeId) {
      await this.disputesRepository.update(
        { id: replacement.disputeId, deletedAt: IsNull() },
        {
          status: DisputeStatus.RESOLVED,
          resolution: `Resolved via replacement ${replacement.id} (${replacement.quantity} unit(s), reason: ${replacement.reason}).`,
          resolvedAt: new Date(),
          resolvedBy: userId,
        },
      );
    }

    return saved;
  }

  /**
   * Create an invoice row when an order is marked PACKED (moved from
   * DELIVERED -- see scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md
   * §7). Bills the actual packed quantity, never the originally requested
   * quantity; an item with packedQuantity === 0 (fully short) does not
   * appear as a billed line at all -- it's not on the invoice, not a $0 row.
   * PDF rendering + S3 upload is deferred (V7) — when wired, the s3Key/s3Url
   * fields can be populated by a separate worker that picks up invoices
   * with empty s3Key.
   */
  private async createInvoiceForPackedOrder(order: Order): Promise<void> {
    // Don't duplicate if already exists
    const existing = await this.invoicesRepository.findOne({ where: { orderId: order.id } });
    if (existing) return;

    const packedItems = (order.items || []).filter((i) => i.packedQuantity > 0);
    // Nothing was actually packed (e.g. zero stock was ever reserved for
    // every item) -- there is nothing to bill. A zero-item, zero-total
    // invoice would be a real row with no real meaning.
    if (packedItems.length === 0) return;

    // Per-item subtotal/GST are recomputed from packedQuantity here, not
    // read from the item's stored subtotal/gstAmount snapshot -- those were
    // computed at order-creation time from the originally requested
    // `quantity` (§4) and are stale the moment packedQuantity differs from
    // it. gstRate itself is an unaffected snapshot field, safe to reuse.
    const items = packedItems.map((i) => {
      const lineSubtotal = Number(i.unitPrice) * i.packedQuantity;
      const lineGstAmount = (lineSubtotal * Number(i.gstRate)) / 100;
      return {
        productId: i.productId,
        productSku: i.productSku,
        productName: i.productName,
        quantity: i.packedQuantity,
        unitPrice: Number(i.unitPrice),
        mrp: i.mrp != null ? Number(i.mrp) : null,
        hsnCode: i.hsnCode || null,
        discountAmount: Number(i.discountAmount) || 0,
        // Pre-tax, pre-discount line amount -- same convention as before
        // this change, GST and discount both stay separate aggregate lines
        // on the invoice rather than being folded into each row.
        totalPrice: lineSubtotal,
        gstAmount: lineGstAmount,
      };
    });
    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
    const gstAmount = items.reduce((sum, i) => sum + i.gstAmount, 0);
    // Per-item discount (§7.3), summed into the single total-discount line
    // the locked business rule calls for -- not shown as a per-line
    // deduction, since the rule is "per-item discount, with a
    // total-discount line in the bill breakdown", not a per-line total.
    const discountAmount = items.reduce((sum, i) => sum + i.discountAmount, 0);
    const totalAmount = subtotal + gstAmount - discountAmount;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${order.orderNumber}`;
    const manufacturerId = packedItems[0]?.manufacturerId;

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
      discountAmount,
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
  // createInvoiceForPackedOrder(). Do not use this as the primary address
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
