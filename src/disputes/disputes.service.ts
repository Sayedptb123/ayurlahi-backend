import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute } from './entities/dispute.entity';
import { DisputeStatus } from '../common/enums/dispute-status.enum';
import { DisputeType } from '../common/enums/dispute-type.enum';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private disputesRepository: Repository<Dispute>,
  ) {}

  async create(
    orderId: string,
    clinicId: string,
    type: DisputeType,
    description: string,
    evidence?: any,
  ): Promise<Dispute> {
    const dispute = this.disputesRepository.create({
      orderId,
      clinicId,
      type,
      description,
      evidence,
      status: DisputeStatus.OPEN,
    });

    return this.disputesRepository.save(dispute);
  }

  async findOne(id: string): Promise<Dispute> {
    const dispute = await this.disputesRepository.findOne({
      where: { id },
      relations: ['order', 'clinic'],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }

    return dispute;
  }

  async findAll(status?: DisputeStatus, limit?: number): Promise<Dispute[]> {
    const where = status ? { status } : {};
    const queryOptions: any = {
      where,
      relations: ['order', 'clinic'],
      order: { createdAt: 'DESC' },
    };
    if (limit) {
      queryOptions.take = limit;
    }
    return this.disputesRepository.find(queryOptions);
  }

  async resolve(
    id: string,
    resolution: string,
    resolvedBy: string,
  ): Promise<Dispute> {
    const dispute = await this.findOne(id);
    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = resolution;
    dispute.resolvedAt = new Date();
    dispute.resolvedBy = resolvedBy;

    return this.disputesRepository.save(dispute);
  }

  async addComment(
    id: string,
    userId: string,
    userName: string,
    comment: string,
  ): Promise<Dispute> {
    const dispute = await this.findOne(id);
    if (!dispute.comments) {
      dispute.comments = [];
    }
    dispute.comments.push({
      userId,
      userName,
      comment,
      createdAt: new Date(),
    });

    return this.disputesRepository.save(dispute);
  }
}

