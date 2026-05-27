import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PatientBill, BillStatus } from './entities/patient-bill.entity';
import { BillItem } from './entities/bill-item.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PaymentDto } from './dto/payment.dto';
import { GetBillsDto } from './dto/get-bills.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PatientBillingService {
  constructor(
    @InjectRepository(PatientBill)
    private billsRepository: Repository<PatientBill>,
    @InjectRepository(BillItem)
    private billItemsRepository: Repository<BillItem>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
    @InjectRepository(OrganisationUser)
    private orgUserRepository: Repository<OrganisationUser>,
    private notificationsService: NotificationsService,
  ) {}

  private calculateBillTotals(items: BillItem[]): { subtotal: number } {
    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.unitPrice) * item.quantity - Number(item.discount),
      0,
    );
    return { subtotal };
  }

  async create(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    createDto: CreateBillDto,
  ) {
    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to create bills',
      );
    }

    const clinicId = organisationId;
    if (!clinicId && userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
      throw new BadRequestException('Clinic not associated with user');
    }

    // Auto-generate billNumber if not provided
    if (!createDto.billNumber) {
      const count = await this.billsRepository.count({ where: { organisationId: clinicId } });
      createDto.billNumber = `BILL-${String(count + 1).padStart(5, '0')}`;
      console.log(`[Billing] Auto-generated billNumber: ${createDto.billNumber}`);
    } else {
      // Check billNumber uniqueness within this org
      const existingBill = await this.billsRepository.findOne({
        where: { billNumber: createDto.billNumber, organisationId: clinicId },
      });
      if (existingBill) {
        throw new ConflictException(
          `Bill number ${createDto.billNumber} already exists`,
        );
      }
    }

    const patient = await this.patientsRepository.findOne({
      where: { id: createDto.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    if (patient.organisationId !== clinicId) {
      throw new ForbiddenException('Patient does not belong to this clinic');
    }

    if (createDto.appointmentId) {
      const appointment = await this.appointmentsRepository.findOne({
        where: { id: createDto.appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }
      if (appointment.organisationId !== clinicId) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
      if (appointment.patientId !== createDto.patientId) {
        throw new BadRequestException(
          'Appointment does not belong to this patient',
        );
      }
    }

    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException('Bill must have at least one item');
    }

    const billItems = createDto.items.map((item) =>
      this.billItemsRepository.create({
        itemType: item.itemType,
        itemName: item.itemName,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        description: item.description || null,
        total: item.unitPrice * (item.quantity || 1) - (item.discount || 0),
      }),
    );

    const { subtotal } = this.calculateBillTotals(billItems);
    const discount = createDto.discount || 0;
    const tax = createDto.tax || 0;
    const total = subtotal - discount + tax;
    const paidAmount = createDto.paidAmount || 0;

    let status = createDto.status || BillStatus.DRAFT;
    if (paidAmount > 0 && paidAmount < total) {
      status = BillStatus.PARTIAL;
    } else if (paidAmount >= total) {
      status = BillStatus.PAID;
    } else if (!createDto.status) {
      status = BillStatus.PENDING;
    }

    const bill = this.billsRepository.create({
      organisationId: clinicId,
      patientId: createDto.patientId,
      appointmentId: createDto.appointmentId || null,
      billNumber: createDto.billNumber,
      billDate: new Date(createDto.billDate),
      dueDate: createDto.dueDate ? new Date(createDto.dueDate) : null,
      subtotal,
      discount,
      tax,
      total,
      paidAmount,
      status,
      paymentMethod: createDto.paymentMethod || null,
      notes: createDto.notes || null,
      items: billItems,
    });

    return this.billsRepository.save(bill);
  }

  async findAll(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    query: GetBillsDto,
  ) {
    const {
      page = 1,
      limit = 20,
      patientId,
      appointmentId,
      status,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException('You do not have permission to view bills');
    }

    const queryBuilder = this.billsRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.patient', 'patient')
      .leftJoinAndSelect('bill.appointment', 'appointment')
      .leftJoinAndSelect('bill.items', 'items');

    if (organisationType === 'CLINIC') {
      if (!organisationId) {
        return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }
      queryBuilder.where('bill.organisationId = :organisationId', {
        organisationId,
      });
    }

    if (patientId) {
      queryBuilder.andWhere('bill.patientId = :patientId', { patientId });
    }

    if (appointmentId) {
      queryBuilder.andWhere('bill.appointmentId = :appointmentId', {
        appointmentId,
      });
    }

    if (status) {
      queryBuilder.andWhere('bill.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('bill.billDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      queryBuilder.andWhere('bill.billDate >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('bill.billDate <= :endDate', { endDate });
    }

    queryBuilder
      .orderBy('bill.billDate', 'DESC')
      .addOrderBy('bill.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const bill = await this.billsRepository.findOne({
      where: { id },
      relations: ['patient', 'appointment', 'items'],
    });

    if (!bill) {
      throw new NotFoundException(`Bill with ID ${id} not found`);
    }

    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== bill.organisationId) {
        throw new ForbiddenException('You do not have access to this bill');
      }
    }

    return bill;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    updateDto: UpdateBillDto,
  ) {
    const bill = await this.billsRepository.findOne({ where: { id } });

    if (!bill) {
      throw new NotFoundException(`Bill with ID ${id} not found`);
    }

    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== bill.organisationId) {
        throw new ForbiddenException('You do not have access to this bill');
      }
    }

    if (updateDto.billNumber && updateDto.billNumber !== bill.billNumber) {
      const existingBill = await this.billsRepository.findOne({
        where: {
          billNumber: updateDto.billNumber,
          organisationId: bill.organisationId,
        },
      });
      if (existingBill) {
        throw new ConflictException(
          `Bill number ${updateDto.billNumber} already exists`,
        );
      }
    }

    if (updateDto.patientId && updateDto.patientId !== bill.patientId) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.organisationId !== bill.organisationId) {
        throw new ForbiddenException('Patient does not belong to this clinic');
      }
    }

    if (
      updateDto.appointmentId &&
      updateDto.appointmentId !== bill.appointmentId
    ) {
      const appointment = await this.appointmentsRepository.findOne({
        where: { id: updateDto.appointmentId },
      });
      if (
        !appointment ||
        appointment.organisationId !== bill.organisationId
      ) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
    }

    if (updateDto.items !== undefined) {
      await this.billItemsRepository.delete({ billId: bill.id });
      bill.items = updateDto.items.map((item) =>
        this.billItemsRepository.create({
          billId: bill.id,
          itemType: item.itemType,
          itemName: item.itemName,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          description: item.description || null,
          total: item.unitPrice * (item.quantity || 1) - (item.discount || 0),
        }),
      );
    }

    if (
      updateDto.items !== undefined ||
      updateDto.discount !== undefined ||
      updateDto.tax !== undefined
    ) {
      const { subtotal } = this.calculateBillTotals(bill.items);
      bill.subtotal = subtotal;
      bill.discount = updateDto.discount ?? bill.discount;
      bill.tax = updateDto.tax ?? bill.tax;
      // total is GENERATED ALWAYS AS (subtotal - discount + tax) in PostgreSQL — do not set
    }

    if (updateDto.billNumber !== undefined)
      bill.billNumber = updateDto.billNumber;
    if (updateDto.patientId !== undefined) bill.patientId = updateDto.patientId;
    if (updateDto.appointmentId !== undefined)
      bill.appointmentId = updateDto.appointmentId;
    if (updateDto.billDate !== undefined)
      bill.billDate = new Date(updateDto.billDate);
    if (updateDto.dueDate !== undefined)
      bill.dueDate = updateDto.dueDate ? new Date(updateDto.dueDate) : null;
    if (updateDto.paidAmount !== undefined) {
      bill.paidAmount = updateDto.paidAmount;
    }
    if (updateDto.status !== undefined) bill.status = updateDto.status;
    if (updateDto.paymentMethod !== undefined)
      bill.paymentMethod = updateDto.paymentMethod;
    if (updateDto.notes !== undefined) bill.notes = updateDto.notes;

    // Recalculate status based on payment
    if (updateDto.paidAmount !== undefined) {
      if (Number(bill.paidAmount) >= Number(bill.total)) {
        bill.status = BillStatus.PAID;
      } else if (Number(bill.paidAmount) > 0) {
        bill.status = BillStatus.PARTIAL;
      } else {
        bill.status = BillStatus.PENDING;
      }
    }

    return this.billsRepository.save(bill);
  }

  async recordPayment(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    paymentDto: PaymentDto,
  ) {
    const bill = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
    );

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Bill is already fully paid');
    }

    if (bill.status === BillStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment for cancelled bill');
    }

    const newPaidAmount = Number(bill.paidAmount) + paymentDto.amount;
    const newBalance = Number(bill.total) - newPaidAmount;

    if (newPaidAmount > Number(bill.total)) {
      throw new BadRequestException(
        'Payment amount exceeds bill total. Overpayment not allowed.',
      );
    }

    bill.paidAmount = newPaidAmount;
    bill.paymentMethod = paymentDto.paymentMethod;

    if (newBalance <= 0) {
      bill.status = BillStatus.PAID;
    } else {
      bill.status = BillStatus.PARTIAL;
    }

    if (paymentDto.notes) {
      bill.notes = bill.notes
        ? `${bill.notes}\nPayment: ${paymentDto.notes}`
        : `Payment: ${paymentDto.notes}`;
    }

    const saved = await this.billsRepository.save(bill);

    // Notify OWNER+MANAGER about payment
    if (saved.organisationId) {
      this.orgUserRepository
        .find({ where: { organisationId: saved.organisationId, role: In(['OWNER', 'MANAGER']), isActive: true } })
        .then((orgUsers) => {
          const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
          if (userIds.length > 0) {
            const amount = `₹${paymentDto.amount.toLocaleString('en-IN')}`;
            if (saved.status === BillStatus.PAID) {
              this.notificationsService.sendToUsers({
                userIds,
                title: 'Bill Fully Paid',
                body: `Bill ${saved.billNumber} fully paid (${amount})`,
                data: { billId: saved.id, type: 'bill_paid' },
              }).catch(() => {});
            } else {
              this.notificationsService.sendToUsers({
                userIds,
                title: 'Partial Payment Received',
                body: `Partial payment of ${amount} received for bill ${saved.billNumber}`,
                data: { billId: saved.id, type: 'payment_received' },
              }).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }

    return saved;
  }

  async remove(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const bill = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
    );
    await this.billsRepository.softDelete(bill.id);
    return { message: 'Bill deleted successfully' };
  }
}
