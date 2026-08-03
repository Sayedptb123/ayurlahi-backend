import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { OrganisationContact } from '../organisations/entities/organisation-contact.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PatientBill } from '../patient-billing/entities/patient-bill.entity';
import { RoomBooking } from '../retreat/entities/room-booking.entity';
import { Admission } from '../retreat/entities/admission.entity';
import { Room } from '../retreat/entities/room.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { GetBranchesDto } from './dto/get-branches.dto';
import { GetPendingBranchesDto } from './dto/get-pending-branches.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganisationSettingsService } from '../organisation-settings/organisation-settings.service';
import {
  PatientVisibility,
  StaffPolicy,
} from '../organisation-settings/entities/organisation-settings.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(OrganisationUser)
    private readonly organisationUsersRepository: Repository<OrganisationUser>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly organisationSettingsService: OrganisationSettingsService,
  ) {}

  private async getOrgOwnerIds(organisationId: string): Promise<string[]> {
    const owners = await this.organisationUsersRepository.find({
      where: { organisationId, role: 'OWNER' as any, isActive: true },
    });
    return owners.map((o) => o.userId).filter(Boolean) as string[];
  }

  private async getTeamUserIds(): Promise<string[]> {
    const teamOrg = await this.dataSource.manager.findOne(Organisation, {
      where: { type: 'AYURLAHI_TEAM' as any },
    });
    if (!teamOrg) return [];
    const members = await this.organisationUsersRepository.find({
      where: { organisationId: teamOrg.id, isActive: true },
    });
    return members.map((m) => m.userId).filter(Boolean) as string[];
  }

  // ADR-004 D5 — the first time an organisation requests an *additional*
  // location, materialise their existing single site as Branch #1 (is_primary,
  // pre-approved — it represents what already existed, not a new request) and
  // backfill every branch-scoped row they already have onto it. Organisations
  // that never add a second location keep branch_id = NULL forever, which
  // already means "organisation-wide" (D9) — this only ever runs once, at the
  // moment it's actually needed, never as a blanket migration.
  private async materialiseFirstBranchAndBackfill(
    organisationId: string,
    createdBy?: string,
    policy?: { patientVisibility?: PatientVisibility; staffPolicy?: StaffPolicy },
  ): Promise<Branch> {
    return this.dataSource.transaction(async (manager) => {
      const org = await manager.findOne(Organisation, { where: { id: organisationId } });
      const contact = await manager.findOne(OrganisationContact, {
        where: { organisationId, isPrimary: true },
      });

      const primaryBranch = manager.create(Branch, {
        organisationId,
        name: org ? `${org.name} (Main)` : 'Main Branch',
        isPrimary: true,
        isActive: true,
        approvalStatus: 'approved',
        address: contact?.addressLine1 ?? null,
        city: contact?.city ?? null,
        state: contact?.state ?? null,
        pincode: contact?.pincode ?? null,
        phone: contact?.phone ?? null,
        createdBy,
      });
      const saved = await manager.save(Branch, primaryBranch);

      await manager.update(Patient, { organisationId, branchId: IsNull() }, { branchId: saved.id });
      await manager.update(PatientBill, { organisationId, branchId: IsNull() }, { branchId: saved.id });
      await manager.update(RoomBooking, { organisationId, branchId: IsNull() }, { branchId: saved.id });
      await manager.update(Admission, { organisationId, branchId: IsNull() }, { branchId: saved.id });
      await manager.update(Room, { organisationId, branchId: IsNull() }, { branchId: saved.id });

      // ADR-004 D2/D5 — the first-additional-location moment is also when the
      // customer answers the onboarding policy questions, if they were asked.
      // Same transaction as the branch/backfill writes above — one atomic event.
      if (policy?.patientVisibility || policy?.staffPolicy) {
        await this.organisationSettingsService.applyOnboardingPolicy(organisationId, policy, manager);
      }

      return saved;
    });
  }

  async create(
    organisationId: string,
    createDto: CreateBranchDto,
    createdBy?: string,
    callerOrgType?: string,
  ): Promise<Branch> {
    // Check for duplicate branch code if provided
    if (createDto.code) {
      const existing = await this.branchesRepository.findOne({
        where: {
          organisationId,
          code: createDto.code,
          deletedAt: IsNull(),
        },
      });
      if (existing) {
        throw new ConflictException('Branch code already exists');
      }
    }

    const existingCount = await this.branchesRepository.count({
      where: { organisationId, deletedAt: IsNull() },
    });
    if (existingCount === 0) {
      await this.materialiseFirstBranchAndBackfill(organisationId, createdBy, {
        patientVisibility: createDto.patientVisibility,
        staffPolicy: createDto.staffPolicy,
      });
    }

    // If setting as primary, unset other primary branches
    if (createDto.isPrimary) {
      await this.branchesRepository.update(
        { organisationId, isPrimary: true, deletedAt: IsNull() },
        { isPrimary: false },
      );
    }

    // ADR-004 D13 — pending by default; Ayurlahi-created branches (if that
    // ever happens) auto-approve, mirroring organisation registration.
    const approvalStatus = callerOrgType === 'AYURLAHI_TEAM' ? 'approved' : 'pending';

    const branch = this.branchesRepository.create({
      ...createDto,
      organisationId,
      createdBy,
      approvalStatus,
    });

    const saved = await this.branchesRepository.save(branch);

    // Notify the team when a branch self-registers and is pending approval —
    // mirrors organisations.service.ts create()'s exact pattern.
    if (approvalStatus === 'pending') {
      this.getTeamUserIds().then((teamUserIds) => {
        if (teamUserIds.length > 0) {
          this.notificationsService.sendToUsers({
            userIds: teamUserIds,
            title: 'New Branch Request',
            body: `${saved.name} has requested a new location and is waiting for approval`,
            data: { branchId: saved.id, type: 'branch_pending' },
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    return saved;
  }

  // Not organisation-scoped — the caller is an Ayurlahi Team reviewer, who by
  // definition doesn't belong to the organisation whose branch they're
  // reviewing (mirrors organisations.service.ts's own approve()/reject()).
  private async findOneAnyOrg(id: string): Promise<Branch> {
    const branch = await this.branchesRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }
    return branch;
  }

  async approve(id: string, approvedBy: string): Promise<Branch> {
    const branch = await this.findOneAnyOrg(id);

    if (branch.approvalStatus === 'approved') {
      throw new BadRequestException('Branch is already approved');
    }

    branch.approvalStatus = 'approved';
    branch.approvedAt = new Date();
    branch.approvedBy = approvedBy;

    const saved = await this.branchesRepository.save(branch);

    this.getOrgOwnerIds(branch.organisationId).then((ownerIds) => {
      if (ownerIds.length > 0) {
        this.notificationsService.sendToUsers({
          userIds: ownerIds,
          title: 'Branch Approved',
          body: `Your new location "${saved.name}" has been approved.`,
          data: { branchId: saved.id, type: 'branch_approved' },
        }).catch(() => {});
      }
    }).catch(() => {});

    return saved;
  }

  async reject(
    id: string,
    rejectionReason: string,
    rejectedBy: string,
  ): Promise<Branch> {
    const branch = await this.findOneAnyOrg(id);

    if (branch.approvalStatus === 'approved') {
      throw new BadRequestException('Cannot reject an approved branch');
    }

    branch.approvalStatus = 'rejected';
    branch.rejectionReason = rejectionReason;
    branch.approvedBy = rejectedBy;

    const saved = await this.branchesRepository.save(branch);

    this.getOrgOwnerIds(branch.organisationId).then((ownerIds) => {
      if (ownerIds.length > 0) {
        this.notificationsService.sendToUsers({
          userIds: ownerIds,
          title: 'Branch Request Update',
          body: `Your request for "${saved.name}" was not approved. Reason: ${rejectionReason}`,
          data: { branchId: saved.id, type: 'branch_rejected' },
        }).catch(() => {});
      }
    }).catch(() => {});

    return saved;
  }

  // Ayurlahi Team's cross-organisation queue — unlike findAll() below, this
  // is deliberately NOT scoped to a single organisationId (a reviewer needs
  // to see every org's pending branches, not just one).
  async findAllPending(
    query: GetPendingBranchesDto,
  ): Promise<{ data: Branch[]; total: number }> {
    const { page = 1, limit = 100, search, approvalStatus = 'pending' } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.branchesRepository
      .createQueryBuilder('branch')
      .leftJoin('branch.organisation', 'organisation')
      .addSelect(['organisation.id', 'organisation.name', 'organisation.type'])
      .where('branch.deletedAt IS NULL')
      .andWhere('branch.approvalStatus = :approvalStatus', { approvalStatus });

    if (search) {
      queryBuilder.andWhere(
        '(branch.name ILIKE :search OR organisation.name ILIKE :search OR branch.city ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('branch.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total };
  }

  async findAll(
    organisationId: string,
    query: GetBranchesDto,
  ): Promise<{ data: Branch[]; total: number }> {
    const { page = 1, limit = 10, search, isActive, isPrimary } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.branchesRepository
      .createQueryBuilder('branch')
      .where('branch.organisationId = :organisationId', { organisationId })
      .andWhere('branch.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(branch.name ILIKE :search OR branch.code ILIKE :search OR branch.city ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('branch.isActive = :isActive', { isActive });
    }

    if (isPrimary !== undefined) {
      queryBuilder.andWhere('branch.isPrimary = :isPrimary', { isPrimary });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('branch.isPrimary', 'DESC')
      .addOrderBy('branch.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string, organisationId: string): Promise<Branch> {
    const branch = await this.branchesRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['manager'],
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    return branch;
  }

  async update(
    id: string,
    organisationId: string,
    updateDto: UpdateBranchDto,
  ): Promise<Branch> {
    const branch = await this.findOne(id, organisationId);

    // Check for duplicate branch code if being updated
    if (updateDto.code && updateDto.code !== branch.code) {
      const existing = await this.branchesRepository.findOne({
        where: {
          organisationId,
          code: updateDto.code,
          deletedAt: IsNull(),
        },
      });
      if (existing) {
        throw new ConflictException('Branch code already exists');
      }
    }

    // If setting as primary, unset other primary branches
    if (updateDto.isPrimary && !branch.isPrimary) {
      await this.branchesRepository.update(
        { organisationId, isPrimary: true, deletedAt: IsNull() },
        { isPrimary: false },
      );
    }

    Object.assign(branch, updateDto);
    return await this.branchesRepository.save(branch);
  }

  async remove(id: string, organisationId: string): Promise<void> {
    const branch = await this.findOne(id, organisationId);
    await this.branchesRepository.softDelete(branch.id);
  }

  async getPrimaryBranch(organisationId: string): Promise<Branch | null> {
    return await this.branchesRepository.findOne({
      where: {
        organisationId,
        isPrimary: true,
        isActive: true,
        deletedAt: IsNull(),
      },
    });
  }
}


