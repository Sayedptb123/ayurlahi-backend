import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ExpensesService {
    constructor(
        @InjectRepository(Expense)
        private expenseRepository: Repository<Expense>,
    ) { }

    async create(createExpenseDto: CreateExpenseDto, user: User) {
        const orgId = user.clinicId || user.manufacturerId;
        if (!orgId) {
            throw new Error('User must belong to an organization to create expenses');
        }

        const expense = this.expenseRepository.create({
            ...createExpenseDto,
            incurredBy: user.id,
            organizationId: orgId,
        });
        return this.expenseRepository.save(expense);
    }

    async findAll(user: User) {
        const organizationId = user.clinicId || user.manufacturerId;
        if (!organizationId) return [];

        return this.expenseRepository.find({
            where: { organizationId },
            order: { date: 'DESC' },
        });
    }

    async findOne(id: string, user: User) {
        const organizationId = user.clinicId || user.manufacturerId;
        if (!organizationId) throw new NotFoundException('Organization not found');

        const expense = await this.expenseRepository.findOne({
            where: { id, organizationId },
        });

        if (!expense) {
            throw new NotFoundException(`Expense with ID ${id} not found`);
        }

        return expense;
    }

    async update(id: string, updateExpenseDto: UpdateExpenseDto, user: User) {
        const expense = await this.findOne(id, user);

        if (updateExpenseDto.status && updateExpenseDto.status !== expense.status) {
            if (updateExpenseDto.status === 'approved' || updateExpenseDto.status === 'rejected') {
                expense.approvedBy = user.id;
                expense.approvedAt = new Date();
            }
        }

        Object.assign(expense, updateExpenseDto);
        return this.expenseRepository.save(expense);
    }

    async remove(id: string, user: User) {
        const expense = await this.findOne(id, user);
        return this.expenseRepository.remove(expense);
    }
}
