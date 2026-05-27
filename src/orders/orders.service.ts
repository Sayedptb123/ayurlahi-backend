import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Order, OrderStatus, OrderSource } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RoleUtils } from '../common/utils/role.utils';

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

    // Validate, lock, and decrement stock inside a transaction to prevent race conditions
    type ProductWithItem = { product: Product; itemDto: (typeof createOrderDto.items)[0] };
    const products: ProductWithItem[] = [];
    let subtotal = 0;
    let totalGstAmount = 0;
    const orderItems: Partial<OrderItem>[] = [];

    await this.productsRepository.manager.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);

      for (const item of createOrderDto.items) {
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

    // Calculate totals from locked-and-decremented products
    for (const { product, itemDto } of products) {
      const itemSubtotal = Number(product.price) * itemDto.quantity;
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
        unitPrice: Number(product.price),
        gstRate: Number(product.gstRate),
        subtotal: itemSubtotal,
        gstAmount: itemGstAmount,
        totalAmount: itemTotal,
        commissionAmount,
        notes: itemDto.notes || null,
      });
    }

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
    if (manufacturerIds.length > 0) {
      this.orgUserRepository
        .find({ where: { organisationId: In(manufacturerIds), role: In(['OWNER', 'MANAGER', 'ADMIN']), isActive: true } })
        .then((orgUsers) => {
          const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
          if (userIds.length > 0) {
            const itemSummary = orderWithRelations?.items?.map((i) => `${i.productName} x${i.quantity}`).join(', ') ?? '';
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

    return orderWithRelations;
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

  async updateStatus(
    id: string,
    userId: string,
    userRole: string,
    organisationType: string | undefined,
    updateDto: UpdateOrderStatusDto,
  ) {
    const order = await this.findOne(id, userId, userRole, organisationType);

    // Only admin, support, and manufacturer can update status
    const normalizedRole = RoleUtils.normalizeRole(userRole, organisationType);
    if (!['admin', 'support', 'manufacturer'].includes(normalizedRole)) {
      throw new ForbiddenException(
        'You do not have permission to update order status',
      );
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
            sku: item.productSku,
            name: item.productName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          })),
        );
      }
    } else if (
      updateDto.status === OrderStatus.CANCELLED &&
      !order.cancelledAt
    ) {
      order.cancelledAt = new Date();
      order.cancelledBy = userId;
      order.cancellationReason = updateDto.notes || null;
    }

    const savedOrder = await this.ordersRepository.save(order);

    // Notify clinic owners/managers about order status change with status-specific message
    const clinicId = savedOrder.organisationId;
    if (clinicId) {
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
        this.orgUserRepository
          .find({ where: { organisationId: clinicId, role: In(['OWNER', 'MANAGER', 'ADMIN']), isActive: true } })
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
}
