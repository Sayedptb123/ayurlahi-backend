import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientBill, BillStatus } from './entities/patient-bill.entity';
import { BillItem } from './entities/bill-item.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PaymentDto } from './dto/payment.dto';
import { GetBillsDto } from './dto/get-bills.dto';

@Injectable()
export class PatientBillingService {
  constructor(
    @InjectRepository(PatientBill)
    private billsRepository: Repository<PatientBill>,
    @InjectRepository(BillItem)
    private billItemsRepository: Repository<BillItem>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
  ) {}

  private calculateBillTotals(items: BillItem[]): {
    subtotal: number;
    total: number;
  } {
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity - item.discount,
      0,
    );
    return { subtotal, total: subtotal };
  }

  async create(userId: string, userRole: string, createDto: CreateBillDto) {
    // Only clinic users and admin can create bills
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to create bills',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const clinicId = user.clinicId;
    if (!clinicId && userRole !== 'admin') {
      throw new BadRequestException('Clinic not associated with user');
    }

    // Check if billNumber is unique
    const existingBill = await this.billsRepository.findOne({
      where: { billNumber: createDto.billNumber },
    });
    if (existingBill) {
      throw new ConflictException(
        `Bill number ${createDto.billNumber} already exists`,
      );
    }

    // Verify patient exists and belongs to clinic
    const patient = await this.patientsRepository.findOne({
      where: { id: createDto.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    if (patient.clinicId !== clinicId) {
      throw new ForbiddenException('Patient does not belong to this clinic');
    }

    // If appointmentId is provided, verify it exists and belongs to clinic
    if (createDto.appointmentId) {
      const appointment = await this.appointmentsRepository.findOne({
        where: { id: createDto.appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }
      if (appointment.clinicId !== clinicId) {
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

    // Validate items
    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException('Bill must have at least one item');
    }

    // Create bill items
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

    // Calculate totals
    const { subtotal } = this.calculateBillTotals(billItems);
    const discount = createDto.discount || 0;
    const tax = createDto.tax || 0;
    const total = subtotal - discount + tax;
    const paidAmount = createDto.paidAmount || 0;
    const balance = total - paidAmount;

    // Determine status
    let status = createDto.status || BillStatus.DRAFT;
    if (paidAmount > 0 && paidAmount < total) {
      status = BillStatus.PARTIAL;
    } else if (paidAmount >= total) {
      status = BillStatus.PAID;
    } else if (!createDto.status) {
      status = BillStatus.PENDING;
    }

    // Create bill
    const bill = this.billsRepository.create({
      clinicId,
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
      balance,
      status,
      paymentMethod: createDto.paymentMethod || null,
      notes: createDto.notes || null,
      items: billItems,
    });

    return this.billsRepository.save(bill);
  }

  async findAll(userId: string, userRole: string, query: GetBillsDto) {
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

    // Only clinic users and admin can view bills
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to view bills');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build query
    const queryBuilder = this.billsRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.patient', 'patient')
      .leftJoinAndSelect('bill.appointment', 'appointment')
      .leftJoinAndSelect('bill.items', 'items');

    // Clinic users can only see their clinic's bills
    if (userRole === 'clinic') {
      if (!user.clinicId) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      queryBuilder.where('bill.clinicId = :clinicId', {
        clinicId: user.clinicId,
      });
    }

    // Filters
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
      queryBuilder.andWhere(
        'bill.billDate BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    } else if (startDate) {
      queryBuilder.andWhere('bill.billDate >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('bill.billDate <= :endDate', { endDate });
    }

    // Order and pagination
    queryBuilder
      .orderBy('bill.billDate', 'DESC')
      .addOrderBy('bill.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const bill = await this.billsRepository.findOne({
      where: { id },
      relations: ['clinic', 'patient', 'appointment', 'items'],
    });

    if (!bill) {
      throw new NotFoundException(`Bill with ID ${id} not found`);
    }

    // Access control
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.clinicId !== bill.clinicId) {
        throw new ForbiddenException('You do not have access to this bill');
      }
    }

    return bill;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateDto: UpdateBillDto,
  ) {
    const bill = await this.findOne(id, userId, userRole);

    // Check billNumber uniqueness if being updated
    if (updateDto.billNumber && updateDto.billNumber !== bill.billNumber) {
      const existingBill = await this.billsRepository.findOne({
        where: { billNumber: updateDto.billNumber },
      });
      if (existingBill) {
        throw new ConflictException(
          `Bill number ${updateDto.billNumber} already exists`,
        );
      }
    }

    // If updating patient or appointment, verify they belong to clinic
    if (updateDto.patientId && updateDto.patientId !== bill.patientId) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.clinicId !== bill.clinicId) {
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
      if (!appointment || appointment.clinicId !== bill.clinicId) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
    }

    // Update items if provided
    if (updateDto.items !== undefined) {
      // Remove existing items
      await this.billItemsRepository.delete({ billId: bill.id });

      // Create new items
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

    // Recalculate totals if items or amounts changed
    if (updateDto.items !== undefined || updateDto.discount !== undefined || updateDto.tax !== undefined) {
      const { subtotal } = this.calculateBillTotals(bill.items);
      bill.subtotal = subtotal;
      bill.discount = updateDto.discount ?? bill.discount;
      bill.tax = updateDto.tax ?? bill.tax;
      bill.total = subtotal - bill.discount + bill.tax;
      bill.balance = bill.total - bill.paidAmount;
    }

    // Update other fields
    if (updateDto.billNumber !== undefined)
      bill.billNumber = updateDto.billNumber;
    if (updateDto.patientId !== undefined)
      bill.patientId = updateDto.patientId;
    if (updateDto.appointmentId !== undefined)
      bill.appointmentId = updateDto.appointmentId;
    if (updateDto.billDate !== undefined)
      bill.billDate = new Date(updateDto.billDate);
    if (updateDto.dueDate !== undefined)
      bill.dueDate = updateDto.dueDate ? new Date(updateDto.dueDate) : null;
    if (updateDto.paidAmount !== undefined) {
      bill.paidAmount = updateDto.paidAmount;
      bill.balance = bill.total - bill.paidAmount;
    }
    if (updateDto.status !== undefined) bill.status = updateDto.status;
    if (updateDto.paymentMethod !== undefined)
      bill.paymentMethod = updateDto.paymentMethod;
    if (updateDto.notes !== undefined) bill.notes = updateDto.notes;

    // Update status based on payment
    if (updateDto.paidAmount !== undefined) {
      if (bill.paidAmount >= bill.total) {
        bill.status = BillStatus.PAID;
        bill.balance = 0;
      } else if (bill.paidAmount > 0) {
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
    paymentDto: PaymentDto,
  ) {
    const bill = await this.findOne(id, userId, userRole);

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Bill is already fully paid');
    }

    if (bill.status === BillStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment for cancelled bill');
    }

    const newPaidAmount = bill.paidAmount + paymentDto.amount;
    const balance = bill.total - newPaidAmount;

    if (newPaidAmount > bill.total) {
      throw new BadRequestException(
        'Payment amount exceeds bill total. Overpayment not allowed.',
      );
    }

    // Update bill
    bill.paidAmount = newPaidAmount;
    bill.balance = balance;
    bill.paymentMethod = paymentDto.paymentMethod;

    // Update status
    if (balance <= 0) {
      bill.status = BillStatus.PAID;
      bill.balance = 0;
    } else {
      bill.status = BillStatus.PARTIAL;
    }

    if (paymentDto.notes) {
      bill.notes = bill.notes
        ? `${bill.notes}\nPayment: ${paymentDto.notes}`
        : `Payment: ${paymentDto.notes}`;
    }

    return this.billsRepository.save(bill);
  }

  async remove(id: string, userId: string, userRole: string) {
    const bill = await this.findOne(id, userId, userRole);
    await this.billsRepository.remove(bill);
    return { message: 'Bill deleted successfully' };
  }
}



