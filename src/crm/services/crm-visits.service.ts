import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmVisit } from '../entities/crm-visit.entity';
import { CrmLead } from '../entities/crm-lead.entity';
import { OrganisationUser } from '../../organisation-users/entities/organisation-user.entity';
import { CrmLeadsService } from './crm-leads.service';
import { CrmAuditService } from './crm-audit.service';
import { ScheduleVisitDto, CheckInDto, CheckOutDto } from '../dto/visit.dto';
import { CrmActor, isCrmManagerTier } from '../crm-access.util';
import { haversineMetres, VISIT_MISMATCH_THRESHOLD_M } from '../crm-geo.util';

@Injectable()
export class CrmVisitsService {
  constructor(
    @InjectRepository(CrmVisit)
    private readonly visitRepo: Repository<CrmVisit>,
    @InjectRepository(OrganisationUser)
    private readonly orgUserRepo: Repository<OrganisationUser>,
    private readonly leadsService: CrmLeadsService,
    private readonly audit: CrmAuditService,
  ) {}

  async listForLead(organisationId: string, leadId: string, actor: CrmActor) {
    await this.leadsService.findOne(organisationId, leadId, actor); // isolation
    return this.visitRepo.find({
      where: { organisationId, leadId },
      order: { scheduledAt: 'DESC', createdAt: 'DESC' },
    });
  }

  /** "My visits" for a field rep. */
  async listMine(organisationId: string, actor: CrmActor) {
    return this.visitRepo.find({
      where: { organisationId, assignedFieldStaffId: actor.userId },
      order: { scheduledAt: 'DESC' },
    });
  }

  async schedule(
    organisationId: string,
    leadId: string,
    dto: ScheduleVisitDto,
    actor: CrmActor,
  ): Promise<CrmVisit> {
    await this.leadsService.findOne(organisationId, leadId, actor); // isolation

    let fieldStaffId = actor.userId;
    if (dto.assignedFieldStaffId && dto.assignedFieldStaffId !== actor.userId) {
      if (!isCrmManagerTier(actor.role)) {
        throw new ForbiddenException('Only a manager can schedule a visit for someone else');
      }
      await this.assertActiveMember(organisationId, dto.assignedFieldStaffId);
      fieldStaffId = dto.assignedFieldStaffId;
    }

    const visit = this.visitRepo.create({
      organisationId,
      leadId,
      assignedFieldStaffId: fieldStaffId,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      createdBy: actor.userId,
    });
    const saved = await this.visitRepo.save(visit);
    await this.audit.record({
      organisationId,
      entityType: 'visit',
      entityId: saved.id,
      action: 'create',
      actorUserId: actor.userId,
    });
    return saved;
  }

  /**
   * Geo-tagged check-in (B5). Captures GPS + timestamp, computes distance from
   * the lead's registered location, and flags a mismatch if >500m. The GPS is
   * captured at the real moment of arrival even when created offline.
   */
  async checkIn(
    organisationId: string,
    visitId: string,
    dto: CheckInDto,
    actor: CrmActor,
  ): Promise<CrmVisit> {
    const visit = await this.getActionableVisit(organisationId, visitId, actor);
    if (visit.checkInAt) {
      throw new BadRequestException('This visit is already checked in');
    }

    const lead = await this.leadsService.findOne(organisationId, visit.leadId, actor);

    let distance: number | null = null;
    let mismatch = false;
    if (lead.latitude != null && lead.longitude != null) {
      distance = haversineMetres(
        parseFloat(String(lead.latitude)),
        parseFloat(String(lead.longitude)),
        dto.latitude,
        dto.longitude,
      );
      mismatch = distance > VISIT_MISMATCH_THRESHOLD_M;
    }

    visit.checkInAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    visit.checkInLatitude = dto.latitude;
    visit.checkInLongitude = dto.longitude;
    visit.distanceFromRegisteredM = distance;
    visit.locationMismatch = mismatch;
    visit.createdOffline = dto.createdOffline ?? false;
    if (dto.createdOffline) visit.syncedAt = new Date();

    const saved = await this.visitRepo.save(visit);
    await this.audit.record({
      organisationId,
      entityType: 'visit',
      entityId: visitId,
      action: 'update',
      actorUserId: actor.userId,
      changes: { event: 'check_in', distanceM: distance, locationMismatch: mismatch },
    });
    // NOTE: location mismatch notifies Manager/Owner — wired in the notification step (B6).
    return saved;
  }

  async checkOut(
    organisationId: string,
    visitId: string,
    dto: CheckOutDto,
    actor: CrmActor,
  ): Promise<CrmVisit> {
    const visit = await this.getActionableVisit(organisationId, visitId, actor);
    if (!visit.checkInAt) {
      throw new BadRequestException('Cannot check out before checking in');
    }
    if (visit.checkOutAt) {
      throw new BadRequestException('This visit is already checked out');
    }

    visit.checkOutAt = new Date();
    if (dto.outcome !== undefined) visit.outcome = dto.outcome;
    if (dto.demoGiven !== undefined) visit.demoGiven = dto.demoGiven;
    if (dto.metPersonName !== undefined) visit.metPersonName = dto.metPersonName;
    if (dto.materialsLeft !== undefined) visit.materialsLeft = dto.materialsLeft;
    if (dto.photos !== undefined) visit.photos = dto.photos;
    if (dto.consentSignatureUrl !== undefined) visit.consentSignatureUrl = dto.consentSignatureUrl;

    const saved = await this.visitRepo.save(visit);
    await this.audit.record({
      organisationId,
      entityType: 'visit',
      entityId: visitId,
      action: 'update',
      actorUserId: actor.userId,
      changes: { event: 'check_out', demoGiven: saved.demoGiven },
    });
    return saved;
  }

  // --------------------------------------------------------------------------
  /** Time on site (minutes), computed on read — never stored (hard rule #4). */
  static minutesOnSite(visit: CrmVisit): number | null {
    if (!visit.checkInAt || !visit.checkOutAt) return null;
    return Math.round(
      (new Date(visit.checkOutAt).getTime() - new Date(visit.checkInAt).getTime()) / 60000,
    );
  }

  private async getActionableVisit(
    organisationId: string,
    visitId: string,
    actor: CrmActor,
  ): Promise<CrmVisit> {
    const visit = await this.visitRepo.findOne({ where: { id: visitId, organisationId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (!isCrmManagerTier(actor.role) && visit.assignedFieldStaffId !== actor.userId) {
      throw new NotFoundException('Visit not found'); // no existence leak
    }
    return visit;
  }

  private async assertActiveMember(organisationId: string, userId: string): Promise<void> {
    const member = await this.orgUserRepo.findOne({
      where: { organisationId, userId, isActive: true },
    });
    if (!member) {
      throw new BadRequestException('Assignee is not an active member of this organisation');
    }
  }
}
