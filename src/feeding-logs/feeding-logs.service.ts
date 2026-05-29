import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FeedingLog } from './entities/feeding-log.entity';
import { CreateFeedingLogDto } from './dto/create-feeding-log.dto';

@Injectable()
export class FeedingLogsService {
  constructor(
    @InjectRepository(FeedingLog)
    private feedingLogsRepository: Repository<FeedingLog>,
  ) {}

  async getFeedingLogs(organisationId: string, patientId?: string): Promise<FeedingLog[]> {
    const where: any = { organisationId, deletedAt: IsNull() };
    if (patientId) {
      where.patientId = patientId;
    }
    return this.feedingLogsRepository.find({
      where,
      order: { feedingTime: 'DESC' },
    });
  }

  async createFeedingLog(
    organisationId: string,
    dto: CreateFeedingLogDto,
    userId: string,
  ): Promise<FeedingLog> {
    const feedingLog = this.feedingLogsRepository.create({
      organisationId,
      patientId: dto.patientId,
      motherPatientId: dto.motherPatientId ?? null,
      recordedBy: userId,
      feedingTime: new Date(dto.feedingTime),
      feedingType: dto.feedingType,
      durationMinutes: dto.durationMinutes ?? null,
      quantityMl: dto.quantityMl ?? null,
      notes: dto.notes ?? null,
    });
    return this.feedingLogsRepository.save(feedingLog);
  }

  async deleteFeedingLog(organisationId: string, id: string): Promise<{ message: string }> {
    const feedingLog = await this.feedingLogsRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!feedingLog) {
      throw new NotFoundException(`Feeding log with ID ${id} not found`);
    }
    feedingLog.deletedAt = new Date();
    await this.feedingLogsRepository.save(feedingLog);
    return { message: 'Feeding log deleted successfully' };
  }
}
