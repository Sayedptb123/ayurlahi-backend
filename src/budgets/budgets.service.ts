import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

export type RequestUser = { userId: string; organisationId: string; role?: string; organisationType?: string };

@Injectable()
export class BudgetsService {
    constructor(
        @InjectRepository(Budget)
        private budgetRepository: Repository<Budget>,
    ) { }

    async create(createBudgetDto: CreateBudgetDto, reqUser: RequestUser) {
        const orgId = reqUser.organisationId;
        if (!orgId) throw new Error('User missing organization');

        const budget = this.budgetRepository.create({
            ...createBudgetDto,
            organisationId: orgId,
        });
        return this.budgetRepository.save(budget);
    }

    async findAll(reqUser: RequestUser) {
        const orgId = reqUser.organisationId;
        if (!orgId) return [];

        return this.budgetRepository.find({
            where: { organisationId: orgId },
            order: { periodStart: 'DESC' },
        });
    }

    async findOne(id: string, reqUser: RequestUser) {
        const orgId = reqUser.organisationId;
        if (!orgId) throw new NotFoundException('Organization not found');

        const budget = await this.budgetRepository.findOne({
            where: { id, organisationId: orgId },
        });
        if (!budget) throw new NotFoundException('Budget not found');
        return budget;
    }

    async update(id: string, updateBudgetDto: UpdateBudgetDto, user: RequestUser) {
        const budget = await this.findOne(id, user);
        Object.assign(budget, updateBudgetDto);
        return this.budgetRepository.save(budget);
    }

    async remove(id: string, user: RequestUser) {
        const budget = await this.findOne(id, user);
        budget.deletedAt = new Date();
        return this.budgetRepository.save(budget);
    }
}
