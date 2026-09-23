import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import { PatientBill, BillStatus, PaymentMethod } from './entities/patient-bill.entity';
import { BillItem, BillItemType } from './entities/bill-item.entity';
import { PatientBillPayment } from './entities/patient-bill-payment.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { RoomBooking } from '../retreat/entities/room-booking.entity';
import { Admission } from '../retreat/entities/admission.entity';
import { Branch } from '../branches/entities/branch.entity';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PaymentDto } from './dto/payment.dto';
import { GetBillsDto } from './dto/get-bills.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
import { organisationBusinessDate } from '../common/business-date';

@Injectable()
export class PatientBillingService {
  constructor(
    @InjectRepository(PatientBill)
    private billsRepository: Repository<PatientBill>,
    @InjectRepository(BillItem)
    private billItemsRepository: Repository<BillItem>,
    @InjectRepository(PatientBillPayment)
    private billPaymentsRepository: Repository<PatientBillPayment>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
    @InjectRepository(OrganisationUser)
    private orgUserRepository: Repository<OrganisationUser>,
    @InjectRepository(RoomBooking)
    private roomBookingsRepository: Repository<RoomBooking>,
    @InjectRepository(Admission)
    private admissionsRepository: Repository<Admission>,
    @InjectRepository(Branch)
    private branchesRepository: Repository<Branch>,
    private notificationsService: NotificationsService,
    private branchVisibilityService: BranchVisibilityService,
  ) {}

  private calculateBillTotals(items: BillItem[]): { subtotal: number } {
    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.unitPrice) * item.quantity - Number(item.discount),
      0,
    );
    return { subtotal };
  }

  // Next auto bill number for an org: highest BILL-n ever issued (soft-deleted
  // bills included, so a number is never reused) + 1. The advisory lock is held
  // until the caller's transaction ends, so two bills created at the same moment
  // can't both take the same number. Must run inside a transaction.
  private async nextBillNumber(
    manager: EntityManager,
    organisationId: string,
  ): Promise<string> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `patient_bill_number:${organisationId}`,
    ]);
    const [row] = await manager.query(
      `SELECT COALESCE(MAX(substring(bill_number FROM '^BILL-([0-9]+)$')::int), 0) AS max
         FROM patient_bills
        WHERE organisation_id = $1`,
      [organisationId],
    );
    return `BILL-${String(Number(row?.max ?? 0) + 1).padStart(5, '0')}`;
  }

  // Builds a PatientBill + BillItem[] (+ first ledger payment, if an advance was
  // already paid) from booking/admission-derived line items, inside the caller's
  // own transaction (ADR-003 Phase 2). Used by RetreatService.checkIn() — kept
  // here so bill/bill-item/ledger construction has one owner, not two parallel
  // paths (this service's own `create()`, and a second inline copy in RetreatService).
  // Takes the caller's EntityManager rather than opening its own transaction, so it
  // participates in checkIn()'s existing locked transaction instead of a separate one.
  async buildBillFromBooking(
    manager: EntityManager,
    params: {
      organisationId: string;
      patientId: string;
      bookingId: string | null;
      admissionId: string;
      lineItems: Array<{ name: string; unitPrice: number }>;
      advancePaid: number;
      createdBy?: string | null;
      branchId?: string | null;
    },
  ): Promise<PatientBill> {
    const { organisationId, patientId, bookingId, admissionId, lineItems, advancePaid, createdBy, branchId } = params;

    const subtotal = lineItems.reduce((s, i) => s + i.unitPrice, 0);
    const status =
      advancePaid <= 0 ? BillStatus.PENDING
      : subtotal > 0 && advancePaid >= subtotal ? BillStatus.PAID
      : subtotal > 0 ? BillStatus.PARTIAL
      : BillStatus.PENDING;

    const billNumber = await this.nextBillNumber(manager, organisationId);
    const today = await organisationBusinessDate(manager, organisationId);

    const bill = manager.create(PatientBill, {
      organisationId,
      patientId,
      bookingId,
      admissionId,
      billNumber,
      billDate: today as unknown as Date,
      subtotal,
      discount: 0,
      tax: 0,
      paidAmount: advancePaid,
      status,
      createdBy: createdBy ?? null,
      branchId: branchId ?? null,
    });
    const savedBill = await manager.save(PatientBill, bill);

    if (lineItems.length > 0) {
      await manager.save(
        BillItem,
        lineItems.map((i) =>
          manager.create(BillItem, {
            billId: savedBill.id,
            itemType: BillItemType.ACCOMMODATION,
            itemName: i.name,
            quantity: 1,
            unitPrice: i.unitPrice,
            discount: 0,
            total: i.unitPrice,
          }),
        ),
      );
    }

    if (advancePaid > 0) {
      const advance = manager.create(PatientBillPayment, {
        organisationId,
        billId: savedBill.id,
        amount: advancePaid,
        paidAt: today,
        paymentMethod: PaymentMethod.CASH,
        notes: 'Advance paid at booking',
        createdBy: createdBy ?? null,
      });
      await manager.save(PatientBillPayment, advance);
    }

    return savedBill;
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

    // No billNumber → one is allocated inside the save transaction below.
    if (createDto.billNumber) {
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

    // Walk-in bill (no patient) vs patient bill are mutually exclusive —
    // reject a request that tries to send both rather than silently
    // persisting contradictory data. See scope/Walkin_Billing_Scope_2026-09-06.md.
    if (createDto.patientId && (createDto.walkInName || createDto.walkInPhone)) {
      throw new BadRequestException(
        'A bill cannot have both a patientId and walk-in details',
      );
    }

    if (createDto.patientId) {
      const patient = await this.patientsRepository.findOne({
        where: { id: createDto.patientId },
      });
      if (!patient) {
        throw new NotFoundException('Patient not found');
      }
      if (patient.organisationId !== clinicId) {
        throw new ForbiddenException('Patient does not belong to this clinic');
      }
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

    if (createDto.bookingId) {
      const booking = await this.roomBookingsRepository.findOne({
        where: { id: createDto.bookingId },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }
      if (booking.organisationId !== clinicId) {
        throw new ForbiddenException('Booking does not belong to this clinic');
      }
    }

    if (createDto.admissionId) {
      const admission = await this.admissionsRepository.findOne({
        where: { id: createDto.admissionId },
      });
      if (!admission) {
        throw new NotFoundException('Admission not found');
      }
      if (admission.organisationId !== clinicId) {
        throw new ForbiddenException('Admission does not belong to this clinic');
      }
    }

    // ADR-004 D9 — validated now even though nothing reads it until Phase 4.
    if (createDto.branchId) {
      const branch = await this.branchesRepository.findOne({
        where: { id: createDto.branchId, organisationId: clinicId },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found in this organisation');
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

    // Money taken while creating a bill is a real payment, so it goes into the
    // ledger like recordPayment() does — never onto paid_amount alone.
    // reconcileBill() recomputes paid_amount from the ledger, so a cache-only
    // amount would silently vanish on the bill's next payment (ADR-003 D3;
    // scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md §2 G1).
    if (paidAmount > 0) {
      if (paidAmount > total + 0.001) {
        throw new BadRequestException(
          'Payment amount exceeds bill total. Overpayment not allowed.',
        );
      }
      if (!createDto.paymentMethod) {
        throw new BadRequestException(
          'paymentMethod is required when paidAmount is set',
        );
      }
      if (createDto.status === BillStatus.CANCELLED) {
        throw new BadRequestException(
          'Cannot record payment for cancelled bill',
        );
      }
    }

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
      patientId: createDto.patientId || null,
      walkInName: createDto.walkInName || null,
      walkInPhone: createDto.walkInPhone || null,
      appointmentId: createDto.appointmentId || null,
      bookingId: createDto.bookingId || null,
      admissionId: createDto.admissionId || null,
      branchId: createDto.branchId || null,
      createdBy: userId,
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

    return this.billsRepository.manager.transaction(async (manager) => {
      if (!bill.billNumber) {
        if (!clinicId) {
          throw new BadRequestException('Clinic not associated with user');
        }
        bill.billNumber = await this.nextBillNumber(manager, clinicId);
      }
      const saved = await manager.save(PatientBill, bill);
      if (paidAmount > 0) {
        await manager.save(
          PatientBillPayment,
          manager.create(PatientBillPayment, {
            organisationId: saved.organisationId,
            billId: saved.id,
            amount: paidAmount,
            paidAt: createDto.billDate.slice(0, 10),
            paymentMethod: createDto.paymentMethod,
            notes: 'Paid at billing',
            createdBy: userId ?? null,
          }),
        );
      }
      return saved;
    }).catch((err) => {
      // A supplied billNumber can still race another request between the
      // uniqueness check above and the insert; the unique index catches it.
      if (err?.code === '23505' && err?.constraint === 'idx_bills_org_number') {
        throw new ConflictException(`Bill number ${bill.billNumber} already exists`);
      }
      throw err;
    });
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
      bookingId,
      admissionId,
      status,
      startDate,
      endDate,
      branchId,
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

      // ADR-004 D9/Phase 4 — branch-level visibility, additive on top of the
      // organisation filter above, never a replacement for it.
      const visibleBranchIds = await this.branchVisibilityService.resolveVisibleBranchIds(
        userId,
        organisationId,
        userRole,
      );
      if (visibleBranchIds !== null) {
        if (visibleBranchIds.length > 0) {
          queryBuilder.andWhere(
            '(bill.branchId IS NULL OR bill.branchId IN (:...visibleBranchIds))',
            { visibleBranchIds },
          );
        } else {
          queryBuilder.andWhere('bill.branchId IS NULL');
        }
      }

      // Branch switcher (personal view filter) — ANDed on top of the visibility
      // filter above, so it can only narrow further, never broaden it. Strict
      // match: "All Locations" is the combined view, so a specific branch
      // selection means only that branch's own records, not org-wide too.
      if (branchId) {
        queryBuilder.andWhere('bill.branchId = :selectedBranchId', { selectedBranchId: branchId });
      }
    }

    if (patientId) {
      queryBuilder.andWhere('bill.patientId = :patientId', { patientId });
    }

    if (appointmentId) {
      queryBuilder.andWhere('bill.appointmentId = :appointmentId', {
        appointmentId,
      });
    }

    if (bookingId) {
      queryBuilder.andWhere('bill.bookingId = :bookingId', { bookingId });
    }

    if (admissionId) {
      queryBuilder.andWhere('bill.admissionId = :admissionId', {
        admissionId,
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

      // ADR-004 D9/Phase 4 — branch-level visibility, additive on top of the
      // organisation check above.
      if (bill.branchId) {
        const visibleBranchIds = await this.branchVisibilityService.resolveVisibleBranchIds(
          userId,
          organisationId,
          userRole,
        );
        if (visibleBranchIds !== null && !visibleBranchIds.includes(bill.branchId)) {
          throw new ForbiddenException('You do not have access to this bill');
        }
      }
    } else if (userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
      // SEC-7: unknown/missing organisationType must never read a bill.
      throw new ForbiddenException('You do not have access to this bill');
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
    } else if (userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
      // SEC-7: unknown/missing organisationType must never edit a bill.
      throw new ForbiddenException('You do not have access to this bill');
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

    if (updateDto.bookingId && updateDto.bookingId !== bill.bookingId) {
      const booking = await this.roomBookingsRepository.findOne({
        where: { id: updateDto.bookingId },
      });
      if (!booking || booking.organisationId !== bill.organisationId) {
        throw new ForbiddenException('Booking does not belong to this clinic');
      }
    }

    if (updateDto.admissionId && updateDto.admissionId !== bill.admissionId) {
      const admission = await this.admissionsRepository.findOne({
        where: { id: updateDto.admissionId },
      });
      if (!admission || admission.organisationId !== bill.organisationId) {
        throw new ForbiddenException('Admission does not belong to this clinic');
      }
    }

    if (updateDto.branchId && updateDto.branchId !== bill.branchId) {
      const branch = await this.branchesRepository.findOne({
        where: { id: updateDto.branchId, organisationId: bill.organisationId },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found in this organisation');
      }
    }

    // Paid amount and the payment-derived statuses (partial/paid) come only from
    // the payment ledger (ADR-003 D3), never from an edit. Checked before the
    // items are replaced below so a rejected update leaves the bill untouched
    // (scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md §2 G2).
    if (
      updateDto.status === BillStatus.PAID ||
      updateDto.status === BillStatus.PARTIAL
    ) {
      throw new BadRequestException(
        'Paid and partial status follow recorded payments — record a payment instead',
      );
    }
    const paid = await this.sumPayments(this.billPaymentsRepository, bill.id);
    if (
      updateDto.status !== undefined &&
      updateDto.status !== BillStatus.CANCELLED &&
      paid > 0
    ) {
      throw new BadRequestException(
        'This bill has recorded payments, so its status follows them',
      );
    }

    const newItems =
      updateDto.items !== undefined
        ? updateDto.items.map((item) =>
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
          )
        : undefined;
    const totalsChanged =
      updateDto.items !== undefined ||
      updateDto.discount !== undefined ||
      updateDto.tax !== undefined;
    if (totalsChanged && paid > 0) {
      const { subtotal } = this.calculateBillTotals(newItems ?? bill.items);
      const newTotal =
        subtotal -
        Number(updateDto.discount ?? bill.discount) +
        Number(updateDto.tax ?? bill.tax);
      if (paid > newTotal + 0.001) {
        throw new BadRequestException(
          'Bill total cannot be less than the amount already paid',
        );
      }
    }

    if (updateDto.items !== undefined) {
      await this.billItemsRepository.delete({ billId: bill.id });
      bill.items = newItems!;
    }

    if (totalsChanged) {
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
    if (updateDto.bookingId !== undefined) bill.bookingId = updateDto.bookingId;
    if (updateDto.admissionId !== undefined)
      bill.admissionId = updateDto.admissionId;
    if (updateDto.branchId !== undefined) bill.branchId = updateDto.branchId;
    if (updateDto.billDate !== undefined)
      bill.billDate = new Date(updateDto.billDate);
    if (updateDto.dueDate !== undefined)
      bill.dueDate = updateDto.dueDate ? new Date(updateDto.dueDate) : null;
    if (updateDto.status !== undefined) bill.status = updateDto.status;
    if (updateDto.paymentMethod !== undefined)
      bill.paymentMethod = updateDto.paymentMethod;
    if (updateDto.notes !== undefined) bill.notes = updateDto.notes;

    // A changed total moves a paid bill between partial and paid; the ledger
    // decides which (same rule as reconcileBill()).
    if (totalsChanged && paid > 0 && bill.status !== BillStatus.CANCELLED) {
      const newTotal =
        Number(bill.subtotal) - Number(bill.discount) + Number(bill.tax);
      bill.status =
        newTotal - paid <= 0.001 ? BillStatus.PAID : BillStatus.PARTIAL;
    }

    bill.updatedBy = userId;

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

    // Insert the payment into the ledger and reconcile the bill's cached
    // paid_amount + status atomically. SUM(ledger) is the source of truth (ADR-003 D3);
    // the row is locked so concurrent payments can't both pass the overpayment guard.
    const saved = await this.billsRepository.manager.transaction(async (manager) => {
      const billRepo = manager.getRepository(PatientBill);
      const payRepo = manager.getRepository(PatientBillPayment);

      // Lock only the patient_bills row (QueryBuilder doesn't auto-join the eager
      // relations that would otherwise make FOR UPDATE fail on an outer join).
      const locked = await billRepo
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.id = :id', { id: bill.id })
        .getOne();
      if (!locked) throw new NotFoundException('Bill not found');

      const prior = await this.sumPayments(payRepo, bill.id);
      if (prior + paymentDto.amount > Number(locked.total) + 0.001) {
        throw new BadRequestException(
          'Payment amount exceeds bill total. Overpayment not allowed.',
        );
      }

      await payRepo.save(
        payRepo.create({
          organisationId: bill.organisationId,
          billId: bill.id,
          amount: paymentDto.amount,
          paidAt: paymentDto.paidAt
            ? paymentDto.paidAt.slice(0, 10)
            : await organisationBusinessDate(manager, bill.organisationId),
          paymentMethod: paymentDto.paymentMethod,
          referenceNo: paymentDto.referenceNo ?? null,
          notes: paymentDto.notes ?? null,
          createdBy: userId ?? null,
        }),
      );

      return this.reconcileBill(manager, bill.id);
    });

    // Notify OWNER+MANAGER about payment
    if (saved.organisationId) {
      this.orgUserRepository
        .find({ where: { organisationId: saved.organisationId, role: In(['OWNER', 'MANAGER']), isActive: true } })
        .then(async (orgUsers) => {
          const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
          if (userIds.length > 0) {
            const amount = `₹${paymentDto.amount.toLocaleString('en-IN')}`;
            // Branch identity travels with the bill's own branchId, never
            // re-derived from whoever is recording the payment. NULL is a
            // valid, organisation-wide state, not an error.
            const branch = saved.branchId
              ? await this.branchesRepository.findOne({ where: { id: saved.branchId } })
              : null;
            const branchLabel = branch?.name ? ` (${branch.name})` : '';
            if (saved.status === BillStatus.PAID) {
              this.notificationsService.sendToUsers({
                userIds,
                title: 'Bill Fully Paid',
                body: `Bill ${saved.billNumber}${branchLabel} fully paid (${amount})`,
                data: { billId: saved.id, type: 'bill_paid' },
              }).catch(() => {});
            } else {
              this.notificationsService.sendToUsers({
                userIds,
                title: 'Partial Payment Received',
                body: `Partial payment of ${amount} received for bill ${saved.billNumber}${branchLabel}`,
                data: { billId: saved.id, type: 'payment_received' },
              }).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }

    return saved;
  }

  // ── Payment ledger helpers (ADR-003) ──────────────────────────────────────

  // Source of truth for "how much is paid": SUM over the live (non-voided) ledger.
  private async sumPayments(
    payRepo: Repository<PatientBillPayment>,
    billId: string,
  ): Promise<number> {
    const row = await payRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'sum')
      .where('p.bill_id = :billId', { billId })
      .andWhere('p.deleted_at IS NULL')
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  // Recompute the cached paid_amount + status from the ledger. Cancelled bills
  // keep their status. Returns the saved bill.
  private async reconcileBill(
    manager: EntityManager,
    billId: string,
  ): Promise<PatientBill> {
    const billRepo = manager.getRepository(PatientBill);
    const payRepo = manager.getRepository(PatientBillPayment);

    const bill = await billRepo.findOne({ where: { id: billId } });
    if (!bill) throw new NotFoundException('Bill not found');

    const paid = await this.sumPayments(payRepo, billId);
    bill.paidAmount = paid;
    // CANCELLED is terminal — never reopened by payment math. Otherwise the status
    // follows the ledger: PENDING (issued, unpaid — the codebase default, and where
    // voiding all payments returns) → PARTIAL → PAID.
    if (bill.status !== BillStatus.CANCELLED) {
      const balance = Number(bill.total) - paid;
      bill.status =
        paid <= 0
          ? BillStatus.PENDING
          : balance <= 0.001
            ? BillStatus.PAID
            : BillStatus.PARTIAL;
    }
    return billRepo.save(bill);
  }

  // List the payment history (ledger) for a bill, newest first.
  async getPayments(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ): Promise<PatientBillPayment[]> {
    await this.findOne(id, userId, userRole, organisationId, organisationType); // org-scope guard
    return this.billPaymentsRepository.find({
      where: { billId: id },
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });
  }

  // Void a payment (soft delete) and re-reconcile the bill.
  async voidPayment(
    id: string,
    paymentId: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ): Promise<PatientBill> {
    await this.findOne(id, userId, userRole, organisationId, organisationType); // org-scope guard

    return this.billsRepository.manager.transaction(async (manager) => {
      const payRepo = manager.getRepository(PatientBillPayment);
      const payment = await payRepo.findOne({ where: { id: paymentId, billId: id } });
      if (!payment) throw new NotFoundException('Payment not found');
      await payRepo.softRemove(payment);
      return this.reconcileBill(manager, id);
    });
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
