import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

import { User } from '../users/entities/user.entity';

@Injectable()
export class BudgetsService {
    constructor(
        @InjectRepository(Budget)
        private budgetRepository: Repository<Budget>,
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) { }

    async create(createBudgetDto: CreateBudgetDto, reqUser: User) {
        const user = await this.usersRepository.findOne({ where: { id: reqUser.id } });
        if (!user) throw new NotFoundException('User not found');

        const orgId = user.clinicId || user.manufacturerId;
        if (!orgId) throw new Error('User missing organization');

        const budget = this.budgetRepository.create({
            ...createBudgetDto,
            organizationId: orgId,
        });
        return this.budgetRepository.save(budget);
    }

    async findAll(reqUser: User) {
        const user = await this.usersRepository.findOne({ where: { id: reqUser.id } });
        if (!user) return [];

        const orgId = user.clinicId || user.manufacturerId;
        if (!orgId) return [];

        return this.budgetRepository.find({
            where: { organizationId: orgId },
            order: { period: 'DESC' },
        });
    }

    async findOne(id: string, reqUser: User) {
        const user = await this.usersRepository.findOne({ where: { id: reqUser.id } });
        if (!user) throw new NotFoundException('User not found');

        const orgId = user.clinicId || user.manufacturerId;
        if (!orgId) throw new NotFoundException('User not associated with an organization');

        const budget = await this.budgetRepository.findOne({
            where: { id, organizationId: orgId },
        });
        if (!budget) throw new NotFoundException('Budget not found');
        return budget;
    }

    async update(id: string, updateBudgetDto: UpdateBudgetDto, user: User) {
        const budget = await this.findOne(id, user);
        Object.assign(budget, updateBudgetDto);
        return this.budgetRepository.save(budget);
    }

    async remove(id: string, user: User) {
        const budget = await this.findOne(id, user);
        return this.budgetRepository.remove(budget);
    }
}
