import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Order, OrderStatus, OrderSource } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

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
  ) {}

  async findAll(userId: string, userRole: string, query: GetOrdersDto) {
    const { page = 1, limit = 20, status, source } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.deletedAt IS NULL');

    // Role-based filtering
    if (userRole === 'clinic') {
      // Clinic users can only see their own orders
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (user && user.clinicId) {
        queryBuilder.andWhere('order.clinicId = :clinicId', {
          clinicId: user.clinicId,
        });
      } else {
        // User has no clinic, return empty
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }
    } else if (userRole === 'manufacturer') {
      // Manufacturer users can only see orders with their products
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (user && user.manufacturerId) {
        queryBuilder.andWhere('items.manufacturerId = :manufacturerId', {
          manufacturerId: user.manufacturerId,
        });
      } else {
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
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

  async findOne(id: string, userId: string, userRole: string) {
    const order = await this.ordersRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Role-based access control
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.clinicId !== order.clinicId) {
        throw new ForbiddenException('You do not have access to this order');
      }
    } else if (userRole === 'manufacturer') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || !user.manufacturerId) {
        throw new ForbiddenException('You do not have access to this order');
      }
      // Check if order has items from this manufacturer
      const hasManufacturerItems = order.items.some(
        (item) => item.manufacturerId === user.manufacturerId,
      );
      if (!hasManufacturerItems) {
        throw new ForbiddenException('You do not have access to this order');
      }
    }

    return order;
  }

  async create(userId: string, createOrderDto: CreateOrderDto) {
    // Get user's clinic
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user || user.role !== 'clinic' || !user.clinicId) {
      throw new ForbiddenException('Only clinic users can create orders');
    }

    // Get clinic data for shipping address if not provided
    const clinic = await this.ordersRepository.manager
      .getRepository('clinics')
      .findOne({ where: { id: user.clinicId } });

    if (!clinic) {
      throw new BadRequestException('Clinic not found');
    }

    // Validate and get products
    const products = await Promise.all(
      createOrderDto.items.map(async (item) => {
        const product = await this.productsRepository.findOne({
          where: { id: item.productId, deletedAt: IsNull() },
        });

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${item.productId} not found`,
          );
        }

        if (!product.isActive) {
          throw new BadRequestException(
            `Product ${product.name} is not active`,
          );
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

        return { product, itemDto: item };
      }),
    );

    // Calculate totals
    let subtotal = 0;
    let totalGstAmount = 0;
    const orderItems: Partial<OrderItem>[] = [];

    for (const { product, itemDto } of products) {
      const itemSubtotal = Number(product.price) * itemDto.quantity;
      const itemGstAmount = (itemSubtotal * Number(product.gstRate)) / 100;
      const itemTotal = itemSubtotal + itemGstAmount;
      const commissionAmount = (itemTotal * 0.05) / 100; // 5% platform commission

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

    const shippingCharges = 0; // Can be calculated based on address
    const platformFee = 0; // Can be calculated
    const totalAmount = subtotal + totalGstAmount + shippingCharges + platformFee;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const order = this.ordersRepository.create({
      clinicId: user.clinicId,
      orderNumber,
      status: OrderStatus.PENDING,
      source: createOrderDto.source || OrderSource.WEB,
      subtotal,
      gstAmount: totalGstAmount,
      shippingCharges,
      platformFee,
      totalAmount,
      shippingAddress:
        createOrderDto.shippingAddress || clinic.address || null,
      shippingCity: createOrderDto.shippingCity || clinic.city || null,
      shippingDistrict: createOrderDto.shippingDistrict || clinic.district || null,
      shippingState: createOrderDto.shippingState || clinic.state || null,
      shippingPincode: createOrderDto.shippingPincode || clinic.pincode || null,
      shippingPhone: createOrderDto.shippingPhone || clinic.phone || null,
      shippingContactName:
        createOrderDto.shippingContactName || clinic.clinicName || null,
      notes: createOrderDto.notes || null,
      items: orderItems as OrderItem[],
    });

    const savedOrder = await this.ordersRepository.save(order);

    // Update product stock
    for (const { product, itemDto } of products) {
      await this.productsRepository.update(product.id, {
        stockQuantity: product.stockQuantity - itemDto.quantity,
      });
    }

    // Reload order with relations
    const orderWithRelations = await this.ordersRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['items'],
    });

    return orderWithRelations;
  }

  async reorder(orderId: string, userId: string) {
    const originalOrder = await this.findOne(orderId, userId, 'clinic');

    const createOrderDto: CreateOrderDto = {
      items: originalOrder.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes || undefined,
      })),
      shippingAddress: originalOrder.shippingAddress || undefined,
      shippingCity: originalOrder.shippingCity || undefined,
      shippingDistrict: originalOrder.shippingDistrict || undefined,
      shippingState: originalOrder.shippingState || undefined,
      shippingPincode: originalOrder.shippingPincode || undefined,
      shippingPhone: originalOrder.shippingPhone || undefined,
      shippingContactName: originalOrder.shippingContactName || undefined,
      notes: `Reorder from order ${originalOrder.orderNumber}`,
      source: OrderSource.WEB,
    };

    return this.create(userId, createOrderDto);
  }

  async updateStatus(
    id: string,
    userId: string,
    userRole: string,
    updateDto: UpdateOrderStatusDto,
  ) {
    const order = await this.findOne(id, userId, userRole);

    // Only admin, support, and manufacturer can update status
    if (!['admin', 'support', 'manufacturer'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to update order status');
    }

    // Update status
    order.status = updateDto.status;

    // Update timestamps based on status
    if (updateDto.status === OrderStatus.CONFIRMED && !order.confirmedAt) {
      order.confirmedAt = new Date();
    } else if (updateDto.status === OrderStatus.SHIPPED && !order.shippedAt) {
      order.shippedAt = new Date();
    } else if (updateDto.status === OrderStatus.DELIVERED && !order.deliveredAt) {
      order.deliveredAt = new Date();
    } else if (updateDto.status === OrderStatus.CANCELLED && !order.cancelledAt) {
      order.cancelledAt = new Date();
      order.cancelledBy = userId;
      order.cancellationReason = updateDto.notes || null;
    }

    return this.ordersRepository.save(order);
  }
}

