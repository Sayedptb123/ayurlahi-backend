import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmLead } from '../entities/crm-lead.entity';
import { CrmTask } from '../entities/crm-task.entity';
import { CrmActivity } from '../entities/crm-activity.entity';

@Injectable()
export class CrmReportsService {
  constructor(
    @InjectRepository(CrmLead) private readonly leadRepo: Repository<CrmLead>,
    @InjectRepository(CrmTask) private readonly taskRepo: Repository<CrmTask>,
    @InjectRepository(CrmActivity) private readonly activityRepo: Repository<CrmActivity>,
  ) {}

  async getFunnelReport(organisationId: string) {
    const data = await this.leadRepo
      .createQueryBuilder('lead')
      .select('lead.stage', 'stage')
      .addSelect('COUNT(*)', 'count')
      .where('lead.organisation_id = :organisationId', { organisationId })
      .andWhere('lead.deleted_at IS NULL')
      .groupBy('lead.stage')
      .getRawMany();
    return data.map(row => ({ stage: row.stage, count: parseInt(row.count, 10) }));
  }

  async getStaffPerformance(organisationId: string) {
    const telecallerLeads = await this.leadRepo
      .createQueryBuilder('lead')
      .select('lead.assigned_telecaller_id', 'staffId')
      .addSelect('COUNT(*)', 'count')
      .where('lead.organisation_id = :organisationId', { organisationId })
      .andWhere('lead.deleted_at IS NULL')
      .andWhere('lead.assigned_telecaller_id IS NOT NULL')
      .groupBy('lead.assigned_telecaller_id')
      .getRawMany();

    const fieldLeads = await this.leadRepo
      .createQueryBuilder('lead')
      .select('lead.assigned_field_staff_id', 'staffId')
      .addSelect('COUNT(*)', 'count')
      .where('lead.organisation_id = :organisationId', { organisationId })
      .andWhere('lead.deleted_at IS NULL')
      .andWhere('lead.assigned_field_staff_id IS NOT NULL')
      .groupBy('lead.assigned_field_staff_id')
      .getRawMany();

    return { telecallerLeads, fieldLeads };
  }

  async exportLeads(organisationId: string) {
    const leads = await this.leadRepo.find({
      where: { organisationId },
      order: { createdAt: 'DESC' }
    });
    return leads;
  }
}
