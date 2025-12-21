import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { OrdersService } from '../orders/orders.service';
import { S3Service } from '../s3/s3.service';
import { InvoiceGeneratorService } from './invoice-generator.service';
import { ClinicsService } from '../clinics/clinics.service';
import { ManufacturersService } from '../manufacturers/manufacturers.service';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { OrderStatus } from '../common/enums/order-status.enum';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    private ordersService: OrdersService,
    private s3Service: S3Service,
    private invoiceGeneratorService: InvoiceGeneratorService,
    private clinicsService: ClinicsService,
    private manufacturersService: ManufacturersService,
  ) {}

  async generateInvoice(orderId: string): Promise<Invoice> {
    const order = await this.ordersService.findOne(orderId);

    if (!order.payment || order.payment.status !== 'captured') {
      throw new Error('Payment must be captured before generating invoice');
    }

    // Check if invoice already exists
    const existingInvoice = await this.invoicesRepository.findOne({
      where: { orderId },
    });

    if (existingInvoice) {
      return existingInvoice;
    }

    const invoiceNumber = await this.generateInvoiceNumber();
    const invoiceDate = new Date();

    // Generate invoice PDF
    const pdfBuffer = await this.invoiceGeneratorService.generatePDF(
      order,
      invoiceNumber,
      invoiceDate,
    );

    // Upload to S3
    const s3Key = `invoices/${orderId}/${invoiceNumber}.pdf`;
    const s3Url = await this.s3Service.uploadFile(s3Key, pdfBuffer, 'application/pdf');

    // Create invoice record
    const invoice = this.invoicesRepository.create({
      orderId: order.id,
      invoiceNumber,
      s3Key,
      s3Url,
      invoiceDate,
      clinicDetails: {
        name: order.clinic.clinicName,
        gstin: order.clinic.gstin,
        address: order.clinic.address,
        city: order.clinic.city,
        state: order.clinic.state,
        pincode: order.clinic.pincode,
      },
      items: order.items.map((item) => ({
        productName: item.productName,
        sku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        subtotal: item.subtotal,
        gstAmount: item.gstAmount,
        total: item.totalAmount,
      })),
      subtotal: order.subtotal,
      gstAmount: order.gstAmount,
      shippingCharges: order.shippingCharges,
      platformFee: order.platformFee,
      totalAmount: order.totalAmount,
      isGstInvoice: !!order.clinic.gstin,
    });

    return this.invoicesRepository.save(invoice);
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    
    const count = await this.invoicesRepository
      .createQueryBuilder('invoice')
      .where('invoice.invoiceDate >= :startOfYear', { startOfYear })
      .andWhere('invoice.invoiceDate < :endOfYear', { endOfYear })
      .getCount();
    
    return `INV-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id },
      relations: ['order', 'order.clinic', 'order.payment', 'order.items', 'order.items.product', 'order.items.product.manufacturer'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async findByOrderId(orderId: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { orderId },
      relations: ['order'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice for order ${orderId} not found`);
    }

    return invoice;
  }

  /**
   * Calculate invoice status based on order and payment status
   */
  private calculateInvoiceStatus(
    invoice: Invoice,
    order: any,
    payment: any,
  ): 'paid' | 'pending' | 'overdue' | 'cancelled' {
    if (order.status === OrderStatus.CANCELLED || payment?.status === PaymentStatus.REFUNDED) {
      return 'cancelled';
    }

    if (payment?.status === PaymentStatus.CAPTURED) {
      return 'paid';
    }

    if (invoice.dueDate && new Date(invoice.dueDate) < new Date() && payment?.status !== PaymentStatus.CAPTURED) {
      return 'overdue';
    }

    return 'pending';
  }

  /**
   * Find all invoices with pagination and role-based filtering
   */
  async findAll(
    userId: string,
    userRole: string,
    filters: {
      page?: number;
      limit?: number;
      status?: 'paid' | 'pending' | 'overdue' | 'cancelled';
      orderId?: string;
      startDate?: string;
      endDate?: string;
    } = {},
  ): Promise<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    // Build query builder
    const queryBuilder = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.order', 'order')
      .leftJoinAndSelect('order.clinic', 'clinic')
      .leftJoinAndSelect('order.payment', 'payment')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.manufacturer', 'manufacturer');

    // Role-based filtering
    if (userRole === 'clinic') {
      const clinic = await this.clinicsService.findByUserId(userId);
      queryBuilder.where('order.clinicId = :clinicId', { clinicId: clinic.id });
    } else if (userRole === 'manufacturer') {
      const manufacturer = await this.manufacturersService.findByUserId(userId);
      queryBuilder
        .innerJoin('order.items', 'orderItems')
        .innerJoin('orderItems.product', 'orderProduct')
        .where('orderProduct.manufacturerId = :manufacturerId', { manufacturerId: manufacturer.id })
        .groupBy('invoice.id');
    }
    // Admin/Support can see all invoices (no filtering)

    // Apply filters
    if (filters.orderId) {
      queryBuilder.andWhere('invoice.orderId = :orderId', { orderId: filters.orderId });
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      queryBuilder.andWhere('invoice.invoiceDate >= :startDate', { startDate });
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day
      queryBuilder.andWhere('invoice.invoiceDate <= :endDate', { endDate });
    }

    // Order by
    queryBuilder.orderBy('invoice.invoiceDate', 'DESC').addOrderBy('invoice.createdAt', 'DESC');

    // If status filter is applied, we need to fetch all matching invoices first
    // to calculate status, then filter and paginate
    let allInvoices: Invoice[];
    let total: number;

    if (filters.status) {
      // Fetch all matching invoices (without pagination) to calculate status
      allInvoices = await queryBuilder.getMany();
      
      // Transform and filter by status
      const transformedInvoices = allInvoices.map((invoice) => {
        const order = invoice.order;
        const payment = order?.payment;
        const status = this.calculateInvoiceStatus(invoice, order, payment);
        return { invoice, status };
      });

      const filteredByStatus = transformedInvoices.filter(
        (item) => item.status === filters.status,
      );

      total = filteredByStatus.length;
      
      // Apply pagination to filtered results
      const paginatedItems = filteredByStatus.slice(skip, skip + limit);
      
      // Transform to final format
      const result = paginatedItems.map(({ invoice, status }) => {
        const order = invoice.order;
        const payment = order?.payment;

        return {
          id: invoice.id,
          orderId: invoice.orderId,
          orderNumber: order?.orderNumber || '',
          invoiceNumber: invoice.invoiceNumber,
          clinicId: order?.clinicId || '',
          clinicName: order?.clinic?.clinicName || invoice.clinicDetails?.name || '',
          manufacturerId: order?.items?.[0]?.product?.manufacturerId || '',
          manufacturerName: order?.items?.[0]?.product?.manufacturer?.companyName || '',
          items: invoice.items || [],
          subtotal: Number(invoice.subtotal),
          gstAmount: Number(invoice.gstAmount),
          shippingCharges: Number(invoice.shippingCharges),
          platformFee: Number(invoice.platformFee),
          total: Number(invoice.totalAmount),
          totalAmount: Number(invoice.totalAmount),
          status,
          issuedAt: invoice.invoiceDate.toISOString(),
          dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
          paidAt: payment?.status === PaymentStatus.CAPTURED && payment?.updatedAt ? payment.updatedAt.toISOString() : null,
          paymentMethod: payment?.method || null,
          invoiceDate: invoice.invoiceDate.toISOString(),
          isGstInvoice: invoice.isGstInvoice,
          s3Url: invoice.s3Url,
          createdAt: invoice.createdAt.toISOString(),
          updatedAt: invoice.updatedAt.toISOString(),
        };
      });

      const totalPages = Math.ceil(total / limit);
      
      return {
        data: result,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } else {
      // No status filter - use normal pagination
      total = await queryBuilder.getCount();
      queryBuilder.skip(skip).take(limit);
      allInvoices = await queryBuilder.getMany();
    }

    // Transform invoices with status calculation
    const transformedInvoices = allInvoices.map((invoice) => {
      const order = invoice.order;
      const payment = order?.payment;
      const status = this.calculateInvoiceStatus(invoice, order, payment);

      return {
        id: invoice.id,
        orderId: invoice.orderId,
        orderNumber: order?.orderNumber || '',
        invoiceNumber: invoice.invoiceNumber,
        clinicId: order?.clinicId || '',
        clinicName: order?.clinic?.clinicName || invoice.clinicDetails?.name || '',
        manufacturerId: order?.items?.[0]?.product?.manufacturerId || '',
        manufacturerName: order?.items?.[0]?.product?.manufacturer?.companyName || '',
        items: invoice.items || [],
        subtotal: Number(invoice.subtotal),
        gstAmount: Number(invoice.gstAmount),
        shippingCharges: Number(invoice.shippingCharges),
        platformFee: Number(invoice.platformFee),
        total: Number(invoice.totalAmount),
        totalAmount: Number(invoice.totalAmount),
        status,
        issuedAt: invoice.invoiceDate.toISOString(),
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
        paidAt: payment?.status === PaymentStatus.CAPTURED && payment?.updatedAt ? payment.updatedAt.toISOString() : null,
        paymentMethod: payment?.method || null,
        invoiceDate: invoice.invoiceDate.toISOString(),
        isGstInvoice: invoice.isGstInvoice,
        s3Url: invoice.s3Url,
        createdAt: invoice.createdAt.toISOString(),
        updatedAt: invoice.updatedAt.toISOString(),
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: transformedInvoices,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Check if user has access to invoice
   */
  async checkAccess(userId: string, userRole: string, invoiceId: string): Promise<boolean> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id: invoiceId },
      relations: ['order', 'order.clinic', 'order.items', 'order.items.product', 'order.items.product.manufacturer'],
    });

    if (!invoice) {
      return false;
    }

    if (userRole === 'admin' || userRole === 'support') {
      return true;
    }

    if (userRole === 'clinic') {
      const clinic = await this.clinicsService.findByUserId(userId);
      return invoice.order.clinicId === clinic.id;
    }

    if (userRole === 'manufacturer') {
      const manufacturer = await this.manufacturersService.findByUserId(userId);
      return invoice.order.items.some(
        (item) => item.product?.manufacturerId === manufacturer.id,
      );
    }

    return false;
  }

  /**
   * Download invoice PDF
   */
  async downloadInvoicePdf(invoiceId: string): Promise<Buffer> {
    const invoice = await this.findOne(invoiceId);
    
    try {
      const pdfBuffer = await this.s3Service.getFile(invoice.s3Key);
      return pdfBuffer;
    } catch (error) {
      throw new NotFoundException('Invoice PDF not found in storage');
    }
  }
}

