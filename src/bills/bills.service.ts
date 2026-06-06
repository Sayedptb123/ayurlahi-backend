import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { RecurringBill, RecurringBillFrequency } from './entities/recurring-bill.entity';
import { BillPayment } from './entities/bill-payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRecurringBillDto } from './dto/create-recurring-bill.dto';
import { UpdateRecurringBillDto } from './dto/update-recurring-bill.dto';
import { LogBillPaymentDto } from './dto/log-bill-payment.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

export type RequestUser = { userId: string; organisationId: string; role?: string; organisationType?: string };

@Injectable()
export class BillsService {
  constructor(
    @InjectRepository(RecurringBill)
    private billRepo: Repository<RecurringBill>,
    @InjectRepository(BillPayment)
    private paymentRepo: Repository<BillPayment>,
    @InjectRepository(Expense)
    private expenseRepo: Repository<Expense>,
    @InjectRepository(OrganisationUser)
    private orgUserRepo: Repository<OrganisationUser>,
    private notificationsService: NotificationsService,
  ) {}

  // --- CRUD Schedules ---

  async create(createDto: CreateRecurringBillDto, reqUser: RequestUser) {
    const bill = this.billRepo.create({
      organisationId: reqUser.organisationId,
      branchId: createDto.branchId ?? null,
      category: createDto.category,
      billName: createDto.billName,
      billType: createDto.billType,
      vendorName: createDto.vendorName,
      vendorAccountNumber: createDto.vendorAccountNumber ?? null,
      vendorContact: createDto.vendorContact ?? null,
      estimatedAmount: createDto.estimatedAmount ?? null,
      frequency: createDto.frequency,
      dayOfMonth: createDto.dayOfMonth ?? null,
      dayOfWeek: createDto.dayOfWeek ?? null,
      customPattern: createDto.customPattern ?? null,
      autoCreateExpense: createDto.autoCreateExpense ?? false,
      autoApprove: createDto.autoApprove ?? false,
      approvalThreshold: createDto.approvalThreshold ?? null,
      autoPay: createDto.autoPay ?? false,
      paymentMethod: createDto.paymentMethod ?? null,
      nextDueDate: new Date(createDto.nextDueDate),
      notes: createDto.notes ?? null,
      createdBy: reqUser.userId,
    });

    return await this.billRepo.save(bill);
  }

  async findAll(reqUser: RequestUser, query: { isActive?: string } = {}) {
    const where: any = {
      organisationId: reqUser.organisationId,
      deletedAt: IsNull(),
    };
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    return await this.billRepo.find({
      where,
      order: { nextDueDate: 'ASC' },
      relations: ['branch'],
    });
  }

  async findOne(id: string, reqUser: RequestUser) {
    const bill = await this.billRepo.findOne({
      where: { id, organisationId: reqUser.organisationId, deletedAt: IsNull() },
      relations: ['branch'],
    });
    if (!bill) {
      throw new NotFoundException('Recurring bill schedule not found');
    }
    return bill;
  }

  async update(id: string, updateDto: UpdateRecurringBillDto, reqUser: RequestUser) {
    const bill = await this.findOne(id, reqUser);

    Object.assign(bill, {
      ...updateDto,
      nextDueDate: updateDto.nextDueDate ? new Date(updateDto.nextDueDate) : bill.nextDueDate,
    });

    return await this.billRepo.save(bill);
  }

  async remove(id: string, reqUser: RequestUser) {
    const bill = await this.findOne(id, reqUser);
    bill.deletedAt = new Date();
    await this.billRepo.save(bill);
    return { success: true };
  }

  // --- Payment History ---

  async getPayments(billId: string, reqUser: RequestUser) {
    // Verify ownership of the parent bill
    await this.findOne(billId, reqUser);

    return await this.paymentRepo.find({
      where: { recurringBillId: billId },
      order: { paidDate: 'DESC' },
      relations: ['expense'],
    });
  }

  async logPayment(billId: string, logDto: LogBillPaymentDto, reqUser: RequestUser) {
    const bill = await this.findOne(billId, reqUser);

    const dueDate = logDto.dueDate ? new Date(logDto.dueDate) : bill.nextDueDate;
    const paidDate = new Date(logDto.paidDate);

    // Calculate late flag
    const isLate = paidDate > dueDate;

    // Create Expense record
    const expense = this.expenseRepo.create({
      organisationId: bill.organisationId,
      amount: logDto.paidAmount,
      category: bill.category,
      description: `Bill Payment: ${bill.billName} - Period ${logDto.billPeriodStart || 'N/A'} to ${logDto.billPeriodEnd || 'N/A'}${logDto.billNumber ? ` (Ref: ${logDto.billNumber})` : ''}`,
      expenseDate: paidDate,
      status: 'verified', // real logged payment is verified
      paymentMethod: bill.paymentMethod ?? 'bank_transfer',
      createdBy: reqUser.userId,
    });
    const savedExpense = await this.expenseRepo.save(expense);

    // Create BillPayment record
    const payment = this.paymentRepo.create({
      recurringBillId: bill.id,
      billPeriodStart: logDto.billPeriodStart ? new Date(logDto.billPeriodStart) : null,
      billPeriodEnd: logDto.billPeriodEnd ? new Date(logDto.billPeriodEnd) : null,
      billAmount: logDto.billAmount,
      billNumber: logDto.billNumber ?? null,
      billDate: logDto.billDate ? new Date(logDto.billDate) : null,
      dueDate: dueDate,
      billUrl: logDto.billUrl ?? null,
      paidAmount: logDto.paidAmount,
      paidDate: paidDate,
      isLate,
      lateFee: logDto.lateFee ?? 0,
      expenseId: savedExpense.id,
    });
    const savedPayment = await this.paymentRepo.save(payment);

    // Advance the recurring bill's next due date if we paid for the current/future cycle
    if (dueDate >= bill.nextDueDate) {
      bill.nextDueDate = this.calculateNextDueDate(bill.nextDueDate, bill.frequency, bill.dayOfMonth ?? undefined, bill.dayOfWeek ?? undefined);
      await this.billRepo.save(bill);
    }

    return savedPayment;
  }

  // --- Scheduler Runner & Manual Process ---

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleNightlyCron() {
    console.log('⏰ Running Nightly Recurring Bills processor...');
    await this.processDueBillsInternal();
  }

  async processDueBillsManual(reqUser: RequestUser) {
    return await this.processDueBillsInternal(reqUser.organisationId);
  }

  private async processDueBillsInternal(organisationId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const queryBuilder = this.billRepo.createQueryBuilder('b')
      .where('b.is_active = :isActive', { isActive: true })
      .andWhere('b.deleted_at IS NULL')
      .andWhere('b.next_due_date <= :today', { today: today.toISOString().split('T')[0] });

    if (organisationId) {
      queryBuilder.andWhere('b.organisation_id = :organisationId', { organisationId });
    }

    const dueBills = await queryBuilder.getMany();
    let processedCount = 0;

    for (const bill of dueBills) {
      try {
        let expenseId: string | null = null;

        // Auto create expense configuration
        if (bill.autoCreateExpense) {
          const expenseAmount = bill.estimatedAmount ? Number(bill.estimatedAmount) : 0;
          let isAutoApproved = bill.autoApprove;

          if (isAutoApproved && bill.approvalThreshold !== null) {
            isAutoApproved = expenseAmount <= Number(bill.approvalThreshold);
          }

          const expense = this.expenseRepo.create({
            organisationId: bill.organisationId,
            amount: expenseAmount,
            category: bill.category,
            description: `Auto-generated: ${bill.billName} (Schedule)`,
            expenseDate: new Date(bill.nextDueDate),
            status: isAutoApproved ? 'verified' : 'pending',
            paymentMethod: bill.paymentMethod ?? 'bank_transfer',
            createdBy: bill.createdBy || undefined,
          });
          const savedExpense = await this.expenseRepo.save(expense);
          expenseId = savedExpense.id;

          // Notify OWNER/MANAGER
          this.notifyOrg(bill.organisationId, 'Recurring Bill Due', `Bill "${bill.billName}" is due. ${isAutoApproved ? 'An approved' : 'A pending'} expense of ₹${expenseAmount.toLocaleString('en-IN')} has been generated.`);

          // If autoPay is active, immediately log the payment record too
          if (bill.autoPay) {
            const payment = this.paymentRepo.create({
              recurringBillId: bill.id,
              billAmount: expenseAmount,
              dueDate: new Date(bill.nextDueDate),
              paidAmount: expenseAmount,
              paidDate: new Date(),
              isLate: false,
              lateFee: 0,
              expenseId: savedExpense.id,
            });
            await this.paymentRepo.save(payment);
          }
        } else {
          // If no auto-create, still notify that the bill is due
          this.notifyOrg(bill.organisationId, 'Recurring Bill Due', `Bill "${bill.billName}" is due on ${bill.nextDueDate}. Record the payment once paid.`);
        }

        // Advance next due date
        bill.nextDueDate = this.calculateNextDueDate(bill.nextDueDate, bill.frequency, bill.dayOfMonth ?? undefined, bill.dayOfWeek ?? undefined);
        await this.billRepo.save(bill);
        processedCount++;
      } catch (err) {
        console.error(`❌ Error processing recurring bill ${bill.id}:`, err.message);
      }
    }

    return { processed: processedCount };
  }

  // --- Helper Calculations ---

  calculateNextDueDate(currentDue: Date, frequency: RecurringBillFrequency, dayOfMonth?: number, dayOfWeek?: number): Date {
    const date = new Date(currentDue);
    
    switch (frequency) {
      case RecurringBillFrequency.DAILY:
        date.setDate(date.getDate() + 1);
        break;
      case RecurringBillFrequency.WEEKLY:
        date.setDate(date.getDate() + 7);
        if (dayOfWeek !== undefined && dayOfWeek !== null) {
          // Adjust to next matching dayOfWeek (1 = Mon, 7 = Sun)
          const currentDay = date.getDay() === 0 ? 7 : date.getDay();
          const diff = (dayOfWeek - currentDay + 7) % 7;
          date.setDate(date.getDate() + (diff === 0 && frequency === RecurringBillFrequency.WEEKLY ? 0 : diff));
        }
        break;
      case RecurringBillFrequency.MONTHLY:
        return this.addMonths(date, 1, dayOfMonth);
      case RecurringBillFrequency.QUARTERLY:
        return this.addMonths(date, 3, dayOfMonth);
      case RecurringBillFrequency.YEARLY:
        return this.addMonths(date, 12, dayOfMonth);
      case RecurringBillFrequency.CUSTOM:
      default:
        // Default to monthly addition if custom is not specified
        date.setDate(date.getDate() + 30);
        break;
    }

    return date;
  }

  private addMonths(date: Date, months: number, dayOfMonth?: number): Date {
    const d = new Date(date);
    const currentMonth = d.getMonth();
    d.setMonth(currentMonth + months);
    
    // SetMonth handles overflows automatically (e.g. setMonth(1) on Jan 31 -> Mar 3)
    // We adjust it back to last day of February in such cases
    if (d.getMonth() !== (currentMonth + months) % 12) {
      d.setDate(0);
    }
    
    if (dayOfMonth !== undefined && dayOfMonth !== null) {
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dayOfMonth, lastDay));
    }
    
    return d;
  }

  private async notifyOrg(orgId: string, title: string, body: string) {
    try {
      const orgUsers = await this.orgUserRepo.find({
        where: { organisationId: orgId, role: In(['OWNER', 'MANAGER']), isActive: true },
      });
      const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
      if (userIds.length > 0) {
        await this.notificationsService.sendToUsers({
          userIds,
          title,
          body,
          data: { type: 'recurring_bill_alert' },
        });
      }
    } catch (e) {
      console.warn('⚠️ Failed to send notification digest:', e.message);
    }
  }
}
