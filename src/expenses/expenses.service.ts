import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { NotificationsService } from '../notifications/notifications.service';

export type RequestUser = { userId: string; organisationId: string; role?: string; organisationType?: string };

export interface GetExpensesQuery {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
}

@Injectable()
export class ExpensesService {
    constructor(
        @InjectRepository(Expense)
        private expenseRepository: Repository<Expense>,
        @InjectRepository(OrganisationUser)
        private orgUserRepository: Repository<OrganisationUser>,
        private notificationsService: NotificationsService,
    ) { }

    async create(createExpenseDto: CreateExpenseDto, reqUser: RequestUser) {
        const orgId = reqUser.organisationId;
        if (!orgId) {
            throw new Error('User must belong to an organization to create expenses');
        }

        const expense = this.expenseRepository.create({
            organisationId: orgId,
            amount: createExpenseDto.amount,
            category: createExpenseDto.category,
            description: createExpenseDto.description,
            expenseDate: new Date(createExpenseDto.date),
            receiptUrl: createExpenseDto.receiptUrl ?? null,
            status: createExpenseDto.status ?? 'pending',
            incurredBy: reqUser.userId,
            createdBy: reqUser.userId,
        });
        const saved = await this.expenseRepository.save(expense);

        // Notify OWNER+MANAGER about new expense
        this.orgUserRepository
            .find({ where: { organisationId: orgId, role: In(['OWNER', 'MANAGER']), isActive: true } })
            .then((orgUsers) => {
                const userIds = orgUsers.map((ou) => ou.userId).filter((id) => id && id !== reqUser.userId);
                if (userIds.length > 0) {
                    this.notificationsService.sendToUsers({
                        userIds,
                        title: 'New Expense Submitted',
                        body: `${saved.category}: ₹${parseFloat(saved.amount as any).toLocaleString('en-IN')} — ${saved.description || 'No description'}`,
                        data: { expenseId: saved.id, type: 'expense_submitted' },
                    }).catch(() => {});
                }
            })
            .catch(() => {});

        return this.formatExpense(saved);
    }

    async findAll(reqUser: RequestUser, query: GetExpensesQuery = {}) {
        const organisationId = reqUser.organisationId;
        if (!organisationId) return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };

        const { page = 1, limit = 20, status, category } = query;
        const skip = (page - 1) * limit;

        const where: any = { organisationId, deletedAt: IsNull() };
        if (status) where.status = status;
        if (category) where.category = category;

        const [expenses, total] = await this.expenseRepository.findAndCount({
            where,
            order: { expenseDate: 'DESC' },
            skip,
            take: limit,
        });

        return {
            data: expenses.map(this.formatExpense),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findOne(id: string, reqUser: RequestUser) {
        const organisationId = reqUser.organisationId;
        if (!organisationId) throw new NotFoundException('Organization not found');

        const expense = await this.expenseRepository.findOne({
            where: { id, organisationId, deletedAt: IsNull() },
        });

        if (!expense) {
            throw new NotFoundException(`Expense with ID ${id} not found`);
        }

        return this.formatExpense(expense);
    }

    async update(id: string, updateExpenseDto: UpdateExpenseDto, reqUser: RequestUser) {
        const managerRoles = ['OWNER', 'MANAGER', 'ADMIN'];
        if (!managerRoles.includes(reqUser.role ?? '')) {
            throw new ForbiddenException('Only managers and owners can verify or flag expenses');
        }

        const expense = await this.expenseRepository.findOne({
            where: { id, organisationId: reqUser.organisationId, deletedAt: IsNull() },
        });
        if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);

        const previousStatus = expense.status;

        if (updateExpenseDto.amount !== undefined) expense.amount = updateExpenseDto.amount;
        if (updateExpenseDto.category !== undefined) expense.category = updateExpenseDto.category;
        if (updateExpenseDto.description !== undefined) expense.description = updateExpenseDto.description;
        if (updateExpenseDto.date !== undefined) expense.expenseDate = new Date(updateExpenseDto.date);
        if (updateExpenseDto.receiptUrl !== undefined) expense.receiptUrl = updateExpenseDto.receiptUrl ?? null;

        if (updateExpenseDto.status !== undefined && updateExpenseDto.status !== previousStatus) {
            expense.status = updateExpenseDto.status;
            if (updateExpenseDto.status === 'verified') {
                expense.approvedBy = reqUser.userId;
                expense.approvedAt = new Date();
                expense.flagReason = null;
            } else if (updateExpenseDto.status === 'flagged') {
                expense.approvedBy = reqUser.userId;
                expense.approvedAt = new Date();
                expense.flagReason = updateExpenseDto.flagReason ?? null;
            }
        }

        const saved = await this.expenseRepository.save(expense);

        // Notify submitter when expense is verified or flagged
        if (updateExpenseDto.status && updateExpenseDto.status !== previousStatus) {
            const submitterId = saved.incurredBy;
            if (submitterId && submitterId !== reqUser.userId) {
                const amount = `₹${parseFloat(saved.amount as any).toLocaleString('en-IN')}`;
                if (updateExpenseDto.status === 'verified') {
                    this.notificationsService.sendToUsers({
                        userIds: [submitterId],
                        title: 'Expense Verified',
                        body: `Your expense of ${amount} (${saved.category}) has been verified`,
                        data: { expenseId: saved.id, type: 'expense_verified' },
                    }).catch(() => {});
                } else if (updateExpenseDto.status === 'flagged') {
                    const reason = saved.flagReason ? `: ${saved.flagReason}` : '';
                    this.notificationsService.sendToUsers({
                        userIds: [submitterId],
                        title: 'Expense Flagged',
                        body: `Your expense of ${amount} (${saved.category}) has been flagged${reason}`,
                        data: { expenseId: saved.id, type: 'expense_flagged' },
                    }).catch(() => {});
                }
            }
        }

        return this.formatExpense(saved);
    }

    async remove(id: string, reqUser: RequestUser) {
        const managerRoles = ['OWNER', 'MANAGER', 'ADMIN'];
        if (!managerRoles.includes(reqUser.role ?? '')) {
            throw new ForbiddenException('Only managers and owners can delete expenses');
        }

        const expense = await this.expenseRepository.findOne({
            where: { id, organisationId: reqUser.organisationId, deletedAt: IsNull() },
        });
        if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
        expense.deletedAt = new Date();
        await this.expenseRepository.save(expense);
        return { message: 'Expense deleted successfully' };
    }

    // Map entity expenseDate → date for API response (frontend compatibility)
    private formatExpense(expense: Expense) {
        const { expenseDate, ...rest } = expense;
        return {
            ...rest,
            date: expenseDate instanceof Date
                ? expenseDate.toISOString().split('T')[0]
                : expenseDate,
        };
    }
}
