import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmPipelineStage } from '../entities/crm-pipeline-stage.entity';

/**
 * Configurable pipeline stages (B2). Also the source of truth for stage
 * ordering used to enforce per-role stage caps in the leads service.
 */
@Injectable()
export class CrmPipelineService {
  constructor(
    @InjectRepository(CrmPipelineStage)
    private readonly stageRepo: Repository<CrmPipelineStage>,
  ) {}

  listStages(organisationId: string, includeInactive = false) {
    const where: any = { organisationId };
    if (!includeInactive) where.isActive = true;
    return this.stageRepo.find({ where, order: { sortOrder: 'ASC' } });
  }

  /** key -> stage, for fast lookups (includes inactive so historical keys resolve). */
  async getStageMap(organisationId: string): Promise<Map<string, CrmPipelineStage>> {
    const stages = await this.stageRepo.find({ where: { organisationId } });
    return new Map(stages.map((s) => [s.key, s]));
  }

  async getStageOrThrow(organisationId: string, key: string): Promise<CrmPipelineStage> {
    const stage = await this.stageRepo.findOne({ where: { organisationId, key } });
    if (!stage) {
      throw new BadRequestException(`Unknown pipeline stage: ${key}`);
    }
    return stage;
  }

  async createStage(
    organisationId: string,
    data: { key: string; label: string; sortOrder?: number; isSideState?: boolean },
  ) {
    const exists = await this.stageRepo.findOne({
      where: { organisationId, key: data.key },
    });
    if (exists) {
      throw new BadRequestException(`Stage '${data.key}' already exists`);
    }
    const stage = this.stageRepo.create({
      organisationId,
      key: data.key,
      label: data.label,
      sortOrder: data.sortOrder ?? 99,
      isSideState: data.isSideState ?? false,
    });
    return this.stageRepo.save(stage);
  }

  async updateStage(
    organisationId: string,
    id: string,
    data: { label?: string; sortOrder?: number; isActive?: boolean },
  ) {
    const stage = await this.stageRepo.findOne({ where: { id, organisationId } });
    if (!stage) throw new NotFoundException('Stage not found');
    Object.assign(stage, data);
    return this.stageRepo.save(stage);
  }
}
