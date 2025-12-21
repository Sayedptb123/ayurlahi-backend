import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual, LessThan } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { OrderStatus } from '../common/enums/order-status.enum';
import { ProductsService } from '../products/products.service';
import { ClinicsService } from '../clinics/clinics.service';
import { ManufacturersService } from '../manufacturers/manufacturers.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    private productsService: ProductsService,
    private clinicsService: ClinicsService,
    private manufacturersService: ManufacturersService,
    private dataSource: DataSource,
  ) {}

  async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    
    const count = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.createdAt >= :startOfYear', { startOfYear })
      .andWhere('order.createdAt < :endOfYear', { endOfYear })
      .getCount();
    
    return `AY-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  async create(clinicId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const clinic = await this.clinicsService.findByUserId(clinicId);
    
    if (clinic.approvalStatus !== 'approved') {
      throw new BadRequestException('Clinic is not approved');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderNumber = await this.generateOrderNumber();
      let subtotal = 0;
      let totalGst = 0;
      const orderItems: OrderItem[] = [];

      // Process each item
      for (const itemDto of createOrderDto.items) {
        const product = await this.productsService.findOne(itemDto.productId);

        if (!product.isActive) {
          throw new BadRequestException(`Product ${product.name} is not available`);
        }

        if (product.stockQuantity < itemDto.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`,
          );
        }

        if (itemDto.quantity < product.minOrderQuantity) {
          throw new BadRequestException(
            `Minimum order quantity for ${product.name} is ${product.minOrderQuantity}`,
          );
        }

        const manufacturer = await this.manufacturersService.findOne(
          product.manufacturerId,
        );

        if (manufacturer.approvalStatus !== 'approved') {
          throw new BadRequestException(
            `Manufacturer for ${product.name} is not approved`,
          );
        }

        const unitPrice = product.price;
        const itemSubtotal = unitPrice * itemDto.quantity;
        const itemGst = (itemSubtotal * product.gstRate) / 100;
        const itemTotal = itemSubtotal + itemGst;
        const commissionAmount = (itemSubtotal * manufacturer.commissionRate) / 100;

        subtotal += itemSubtotal;
        totalGst += itemGst;

        const orderItem = this.orderItemsRepository.create({
          orderId: '', // Will be set after order creation
          productId: product.id,
          manufacturerId: manufacturer.id,
          productSku: product.sku,
          productName: product.name,
          quantity: itemDto.quantity,
          unitPrice,
          gstRate: product.gstRate,
          subtotal: itemSubtotal,
          gstAmount: itemGst,
          totalAmount: itemTotal,
          commissionAmount,
          notes: itemDto.notes,
        });

        orderItems.push(orderItem);

        // Update stock
        await this.productsService.updateStock(product.id, -itemDto.quantity);
      }

      const platformFee = 0; // Can be calculated based on subscription
      const shippingCharges = 0; // Can be calculated based on location
      const totalAmount = subtotal + totalGst + platformFee + shippingCharges;

      // Use clinic address if shipping address not provided
      const shippingAddress =
        createOrderDto.shippingAddress || clinic.address;
      const shippingCity = createOrderDto.shippingCity || clinic.city;
      const shippingDistrict = createOrderDto.shippingDistrict || clinic.district;
      const shippingState = createOrderDto.shippingState || clinic.state;
      const shippingPincode = createOrderDto.shippingPincode || clinic.pincode;
      const shippingPhone = createOrderDto.shippingPhone || clinic.phone;

      const order = this.ordersRepository.create({
        clinicId: clinic.id,
        orderNumber,
        status: OrderStatus.PENDING,
        source: createOrderDto.source,
        whatsappMessageId: createOrderDto.whatsappMessageId,
        subtotal,
        gstAmount: totalGst,
        shippingCharges,
        platformFee,
        totalAmount,
        shippingAddress,
        shippingCity,
        shippingDistrict,
        shippingState,
        shippingPincode,
        shippingPhone,
        shippingContactName: createOrderDto.shippingContactName || clinic.clinicName,
        notes: createOrderDto.notes,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // Set orderId for items and save
      for (const item of orderItems) {
        item.orderId = savedOrder.id;
        await queryRunner.manager.save(item);
      }

      await queryRunner.commitTransaction();

      return this.findOne(savedOrder.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(clinicId?: string, manufacturerId?: string): Promise<Order[]> {
    const where: any = {};
    if (clinicId) {
      where.clinicId = clinicId;
    }

    const relations = ['clinic', 'items', 'items.product', 'items.manufacturer'];

    if (manufacturerId) {
      // For manufacturers, filter by order items
      const orders = await this.ordersRepository.find({
        where,
        relations,
      });
      return orders.filter((order) =>
        order.items.some((item) => item.manufacturerId === manufacturerId),
      );
    }

    return this.ordersRepository.find({
      where,
      relations,
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['clinic', 'items', 'items.product', 'items.manufacturer', 'payment', 'invoice'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    updatedBy?: string,
  ): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;

    if (status === OrderStatus.CONFIRMED) {
      order.confirmedAt = new Date();
    } else if (status === OrderStatus.SHIPPED) {
      order.shippedAt = new Date();
    } else if (status === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
    } else if (status === OrderStatus.CANCELLED) {
      order.cancelledAt = new Date();
      if (updatedBy) {
        order.cancelledBy = updatedBy;
      }
    }

    return this.ordersRepository.save(order);
  }

  async cancel(id: string, reason: string, cancelledBy: string): Promise<Order> {
    const order = await this.findOne(id);

    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel order in ${order.status} status`);
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    order.cancelledBy = cancelledBy;
    order.cancellationReason = reason;

    // Restore stock
    for (const item of order.items) {
      await this.productsService.updateStock(item.productId, item.quantity);
    }

    return this.ordersRepository.save(order);
  }

  async updateOrderItem(
    orderId: string,
    itemId: string,
    updateDto: UpdateOrderItemDto,
  ): Promise<OrderItem> {
    const order = await this.findOne(orderId);
    const item = order.items.find((i) => i.id === itemId);

    if (!item) {
      throw new NotFoundException(`Order item with ID ${itemId} not found`);
    }

    if (updateDto.shippedQuantity !== undefined) {
      if (updateDto.shippedQuantity > item.quantity) {
        throw new BadRequestException(
          `Shipped quantity cannot exceed ordered quantity`,
        );
      }
      item.shippedQuantity = updateDto.shippedQuantity;
      if (updateDto.shippedQuantity > 0) {
        item.status = 'shipped';
      }
    }

    if (updateDto.deliveredQuantity !== undefined) {
      if (updateDto.deliveredQuantity > item.shippedQuantity) {
        throw new BadRequestException(
          `Delivered quantity cannot exceed shipped quantity`,
        );
      }
      item.deliveredQuantity = updateDto.deliveredQuantity;
      if (updateDto.deliveredQuantity === item.quantity) {
        item.status = 'delivered';
      } else if (updateDto.deliveredQuantity > 0) {
        item.status = 'shipped'; // Partially delivered
      }
    }

    if (updateDto.status) {
      item.status = updateDto.status;
    }

    if (updateDto.notes) {
      item.notes = updateDto.notes;
    }

    await this.orderItemsRepository.save(item);

    // Check if all items are delivered to update order status
    const allDelivered = order.items.every(
      (i) => i.deliveredQuantity === i.quantity,
    );
    const someDelivered = order.items.some(
      (i) => i.deliveredQuantity > 0 && i.deliveredQuantity < i.quantity,
    );

    if (allDelivered) {
      await this.updateStatus(orderId, OrderStatus.DELIVERED);
    } else if (someDelivered) {
      await this.updateStatus(orderId, OrderStatus.PARTIALLY_FULFILLED);
    }

    return item;
  }
}
