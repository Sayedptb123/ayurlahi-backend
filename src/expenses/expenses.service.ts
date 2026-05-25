import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

export type RequestUser = { userId: string; organisationId: string; role?: string; organisationType?: string };

@Injectable()
export class ExpensesService {
    constructor(
        @InjectRepository(Expense)
        private expenseRepository: Repository<Expense>,
    ) { }

    async create(createExpenseDto: CreateExpenseDto, reqUser: RequestUser) {
        const orgId = reqUser.organisationId;
        if (!orgId) {
            throw new Error('User must belong to an organization to create expenses');
        }

        const expense = this.expenseRepository.create({
            ...createExpenseDto,
            incurredBy: reqUser.userId,
            organisationId: orgId,
        });
        return this.expenseRepository.save(expense);
    }

    async findAll(reqUser: RequestUser) {
        const organisationId = reqUser.organisationId;
        if (!organisationId) return [];

        return this.expenseRepository.find({
            where: { organisationId },
            order: { date: 'DESC' },
        });
    }

    async findOne(id: string, reqUser: RequestUser) {
        const organisationId = reqUser.organisationId;
        if (!organisationId) throw new NotFoundException('Organization not found');

        const expense = await this.expenseRepository.findOne({
            where: { id, organisationId },
        });

        if (!expense) {
            throw new NotFoundException(`Expense with ID ${id} not found`);
        }

        return expense;
    }

    async update(id: string, updateExpenseDto: UpdateExpenseDto, reqUser: RequestUser) {
        const expense = await this.findOne(id, reqUser);

        if (updateExpenseDto.status && updateExpenseDto.status !== expense.status) {
            if (updateExpenseDto.status === 'approved' || updateExpenseDto.status === 'rejected') {
                expense.approvedBy = reqUser.userId;
                expense.approvedAt = new Date();
            }
        }

        Object.assign(expense, updateExpenseDto);
        return this.expenseRepository.save(expense);
    }

    async remove(id: string, reqUser: RequestUser) {
        const expense = await this.findOne(id, reqUser);
        expense.deletedAt = new Date();
        return this.expenseRepository.save(expense);
    }
}
