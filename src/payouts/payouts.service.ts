import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout } from './entities/payout.entity';
import { GetPayoutsDto } from './dto/get-payouts.dto';

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(Payout)
    private readonly payoutsRepository: Repository<Payout>,
  ) {}

  async findAll(organisationId: string, userRole: string, query: GetPayoutsDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const isAdmin = ['SUPER_ADMIN', 'SUPPORT'].includes(userRole);

    const qb = this.payoutsRepository
      .createQueryBuilder('payout')
      .leftJoinAndSelect('payout.organisation', 'organisation')
      .orderBy('payout.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (!isAdmin) {
      qb.andWhere('payout.organisationId = :organisationId', { organisationId });
    } else if (query.manufacturerId) {
      qb.andWhere('payout.organisationId = :organisationId', {
        organisationId: query.manufacturerId,
      });
    }

    if (query.status) {
      qb.andWhere('payout.status = :status', { status: query.status });
    }

    const [payouts, total] = await qb.getManyAndCount();

    const data = payouts.map((p) => ({
      id: p.id,
      manufacturerId: p.organisationId,
      manufacturer: { name: p.organisation?.name ?? '—' },
      amount: parseFloat(String(p.amount)),
      status: p.status,
      orderId: p.orderId ?? undefined,
      transactionRef: p.transactionRef ?? undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organisationId: string, userRole: string) {
    const isAdmin = ['SUPER_ADMIN', 'SUPPORT'].includes(userRole);

    const payout = await this.payoutsRepository.findOne({
      where: { id },
      relations: ['organisation'],
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (!isAdmin && payout.organisationId !== organisationId) {
      throw new NotFoundException('Payout not found');
    }

    return {
      id: payout.id,
      manufacturerId: payout.organisationId,
      manufacturer: { name: payout.organisation?.name ?? '—' },
      amount: parseFloat(String(payout.amount)),
      status: payout.status,
      orderId: payout.orderId ?? undefined,
      transactionRef: payout.transactionRef ?? undefined,
      notes: payout.notes ?? undefined,
      createdAt: payout.createdAt,
      updatedAt: payout.updatedAt,
    };
  }
}
