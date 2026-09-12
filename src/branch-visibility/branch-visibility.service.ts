import { ForbiddenException, Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Staff } from '../staff/entities/staff.entity';
import { StaffBranchAssignment } from '../staff-branch-assignments/entities/staff-branch-assignment.entity';
import { OrganisationSettingsService } from '../organisation-settings/organisation-settings.service';
import { PatientVisibility, InventoryPolicy } from '../organisation-settings/entities/organisation-settings.entity';
import { Branch } from '../branches/entities/branch.entity';

// Organisation leadership roles are never branch-scoped — an OWNER/ADMIN/MANAGER
// has no `staff` row in most orgs (they're not front-line staff), and even when
// they do, branch isolation exists to scope front-line staff, not leadership.
// Without this, resolveVisibleBranchIds would fail-closed on the missing staff
// row and lock the org's own owner out of their org's data.
const ORG_WIDE_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER']);

// ADR-004 D9/D2 — the single place that answers "which branches can this user
// see patient/booking/bill data for". Every query that needs branch-level
// scoping (Phase 4) goes through this, so the fail-closed rule lives in
// exactly one place rather than being re-derived per service.
@Injectable()
export class BranchVisibilityService {
  constructor(
    private readonly organisationSettingsService: OrganisationSettingsService,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(StaffBranchAssignment)
    private readonly assignmentsRepository: Repository<StaffBranchAssignment>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  // Returns:
  //   null      — no branch filter should be applied (patientVisibility is
  //               'shared', there's no organisation context at all, e.g.
  //               a SUPER_ADMIN/SUPPORT request, or the caller holds an
  //               org-wide leadership role). Caller sees everything in the
  //               organisation, exactly like today, before this phase.
  //   string[]  — the exact set of branch IDs this user may see. An EMPTY
  //               array is a valid, deliberate result — a staff member with
  //               no active branch assignment sees nothing branch-scoped,
  //               not everything. Fail closed, never fail open.
  async resolveVisibleBranchIds(
    userId: string | undefined,
    organisationId: string | undefined,
    role?: string,
  ): Promise<string[] | null> {
    if (!organisationId) return null;
    const settings = await this.organisationSettingsService.getOrCreate(organisationId);
    if (settings.patientVisibility !== PatientVisibility.ISOLATED) return null;
    return this.resolveViaAssignments(userId, organisationId, role);
  }

  // ADR-005 Step 3 — same contract and same fail-closed rule as
  // resolveVisibleBranchIds above, but gated on inventoryPolicy instead of
  // patientVisibility. Deliberately NOT derived from patientVisibility —
  // an org's patient and inventory visibility are independent decisions
  // (Invariant 1 of Step3_Inventory_Service_Cutover_Implementation_Plan.md).
  async resolveVisibleBranchIdsForInventory(
    userId: string | undefined,
    organisationId: string | undefined,
    role?: string,
  ): Promise<string[] | null> {
    if (!organisationId) return null;
    const settings = await this.organisationSettingsService.getOrCreate(organisationId);
    if (settings.inventoryPolicy !== InventoryPolicy.PER_BRANCH) return null;
    return this.resolveViaAssignments(userId, organisationId, role);
  }

  // Shared tail of both resolvers above — same staff_branch_assignments
  // lookup and ORG_WIDE_ROLES exemption regardless of which policy field
  // gated entry into it.
  private async resolveViaAssignments(
    userId: string | undefined,
    organisationId: string,
    role?: string,
  ): Promise<string[] | null> {
    if (role && ORG_WIDE_ROLES.has(role)) return null;
    if (!userId) return [];

    const staff = await this.staffRepository.findOne({
      where: { userId, organisationId },
    });
    if (!staff) return [];

    const assignments = await this.assignmentsRepository.find({
      where: { staffId: staff.id, organisationId, isActive: true },
    });
    return assignments.map((a) => a.branchId);
  }

  // ADR-005 Step 3 (§1.5) — the single choke point every inventory/purchase-
  // order WRITE path resolves its branchId through. A client-supplied
  // branchId is a request, never a trusted value: this method is the only
  // place that turns "what the caller asked for" into "what's actually
  // written". Throws rather than returning an ambiguous value, since a
  // write (unlike a read) has no safe default to fall back to.
  async resolveBranchIdForWrite(
    organisationId: string,
    userId: string | undefined,
    role: string | undefined,
    requestedBranchId?: string | null,
  ): Promise<string | null> {
    const settings = await this.organisationSettingsService.getOrCreate(organisationId);
    const branchCount = await this.branchesRepository.count({
      where: { organisationId, deletedAt: IsNull() },
    });

    // Not a per-branch org (the common case today). A requested branchId
    // is ignored, not honored -- the write is resolved to whatever this
    // org's existing rows already use, never re-derived from the request.
    //
    // BUG FIXED 2026-09-12 (found auditing for Step 4, before any Step 4
    // code existed): this used to unconditionally return null here. That
    // was wrong for SAIFIS/CNS/PMS -- each already has a real primary
    // branch (from ADR-004 D9/D5 or the Step 2 backfill), and their
    // existing inventory_branch_stock rows already carry that branch's
    // real UUID, NOT null. Returning null caused update()/remove() to
    // search for a branchId=null row, fail to find the real one, and
    // silently CREATE A DUPLICATE phantom row instead of touching the
    // real one -- a live data-integrity bug on real customer data (three
    // independently-drifting copies of the same item, exactly what the
    // authoritative-source invariant exists to prevent). NULL is only
    // correct for a genuinely branch-less org (zero branches, e.g. Anjala
    // Ayur Home) -- "not per-branch" and "has no branches" are different
    // facts and must not be conflated.
    if (settings.inventoryPolicy !== InventoryPolicy.PER_BRANCH) {
      if (branchCount === 0) return null;
      const primary = await this.branchesRepository.findOne({
        where: { organisationId, isPrimary: true, deletedAt: IsNull() },
      });
      return primary?.id ?? null;
    }

    if (!requestedBranchId) {
      throw new BadRequestException(
        'This organisation tracks inventory per branch — a branchId is required for this action.',
      );
    }

    const branch = await this.branchesRepository.findOne({
      where: { id: requestedBranchId, organisationId, deletedAt: IsNull() },
    });
    if (!branch) {
      throw new BadRequestException('Branch not found for this organisation.');
    }

    if (role && ORG_WIDE_ROLES.has(role)) return branch.id;

    const visible = await this.resolveViaAssignments(userId, organisationId, role);
    if (visible !== null && !visible.includes(branch.id)) {
      throw new ForbiddenException('You do not have access to this branch.');
    }
    return branch.id;
  }
}
