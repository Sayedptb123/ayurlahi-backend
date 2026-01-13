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
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) { }

    async create(createExpenseDto: CreateExpenseDto, reqUser: User) {
        const user = await this.usersRepository.findOne({ where: { id: reqUser.id } });
        if (!user) throw new NotFoundException('User not found');

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

    async findAll(reqUser: User) {
        const user = await this.usersRepository.findOne({ where: { id: reqUser.id } });
        if (!user) return [];

        const organizationId = user.clinicId || user.manufacturerId;
        if (!organizationId) return [];

        return this.expenseRepository.find({
            where: { organizationId },
            order: { date: 'DESC' },
        });
    }

    async findOne(id: string, reqUser: User) {
        const user = await this.usersRepository.findOne({ where: { id: reqUser.id } });
        if (!user) throw new NotFoundException('User not found');

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
