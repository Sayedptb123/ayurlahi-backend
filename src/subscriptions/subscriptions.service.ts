import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionsRepository: Repository<Subscription>,
  ) {}

  async create(
    clinicId: string,
    planName: string,
    monthlyFee: number,
    features: any,
  ): Promise<Subscription> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    const subscription = this.subscriptionsRepository.create({
      clinicId,
      planName,
      monthlyFee,
      features,
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate,
    });

    return this.subscriptionsRepository.save(subscription);
  }

  async findOne(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionsRepository.findOne({
      where: { id },
      relations: ['clinic'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    return subscription;
  }

  async findByClinicId(clinicId: string): Promise<Subscription | null> {
    return this.subscriptionsRepository.findOne({
      where: { clinicId, status: SubscriptionStatus.ACTIVE },
      relations: ['clinic'],
      order: { createdAt: 'DESC' },
    });
  }

  async cancel(id: string, reason: string): Promise<Subscription> {
    const subscription = await this.findOne(id);
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason;

    return this.subscriptionsRepository.save(subscription);
  }
}





