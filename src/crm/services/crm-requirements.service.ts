import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmRequirement } from '../entities/crm-requirement.entity';
import { CrmLeadsService } from './crm-leads.service';
import { CrmAuditService } from './crm-audit.service';
import { CreateRequirementDto, UpdateRequirementDto } from '../dto/requirement.dto';
import { CrmActor } from '../crm-access.util';

@Injectable()
export class CrmRequirementsService {
  constructor(
    @InjectRepository(CrmRequirement)
    private readonly reqRepo: Repository<CrmRequirement>,
    private readonly leadsService: CrmLeadsService,
    private readonly audit: CrmAuditService,
  ) {}

  async listForLead(organisationId: string, leadId: string, actor: CrmActor) {
    await this.leadsService.findOne(organisationId, leadId, actor); // isolation
    return this.reqRepo.find({
      where: { organisationId, leadId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    organisationId: string,
    leadId: string,
    dto: CreateRequirementDto,
    actor: CrmActor,
  ): Promise<CrmRequirement> {
    await this.leadsService.findOne(organisationId, leadId, actor); // isolation
    const req = new CrmRequirement();
    Object.assign(req, dto, {
      organisationId,
      leadId,
      capturedByUserId: actor.userId,
    });
    const saved = await this.reqRepo.save(req);
    await this.audit.record({
      organisationId,
      entityType: 'requirement',
      entityId: saved.id,
      action: 'create',
      actorUserId: actor.userId,
    });
    return saved;
  }

  async update(
    organisationId: string,
    leadId: string,
    id: string,
    dto: UpdateRequirementDto,
    actor: CrmActor,
  ): Promise<CrmRequirement> {
    await this.leadsService.findOne(organisationId, leadId, actor); // isolation
    const req = await this.reqRepo.findOne({ where: { id, organisationId, leadId } });
    if (!req) throw new NotFoundException('Requirement not found');

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      if ((req as any)[k] !== v) {
        before[k] = (req as any)[k];
        after[k] = v;
        (req as any)[k] = v;
      }
    }
    const saved = await this.reqRepo.save(req);
    if (Object.keys(after).length > 0) {
      await this.audit.record({
        organisationId,
        entityType: 'requirement',
        entityId: id,
        action: 'update',
        actorUserId: actor.userId,
        changes: { before, after },
      });
    }
    return saved;
  }
}
