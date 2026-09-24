import { ForbiddenException, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { Staff } from '../staff/entities/staff.entity';
import { StaffBranchAssignment } from '../staff-branch-assignments/entities/staff-branch-assignment.entity';
import { OrganisationSettingsService } from '../organisation-settings/organisation-settings.service';
import { PatientVisibility, InventoryPolicy } from '../organisation-settings/entities/organisation-settings.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Patient } from '../patients/entities/patient.entity';

// ── Branch scoping v2 (scope/Branch_Scoping_Remediation_Plan_2026-09-24.md §7, §10–11)
//
// One rule for every branch-owned record, used by reads, single-record
// access, actions and writes alike:
//   READ    applyBranchScope / applyPatientBranchScope, then narrowToSelectedBranch
//   ACTION  assertBranchAccess / assertPatientAccess   (404 outside scope — Q2)
//   WRITE   resolveWriteBranch                         (trusted branch — Q3)
// The switcher (narrowToSelectedBranch) only ever narrows *after* scope; it is
// never the security mechanism.
export type BranchScope =
  | { kind: 'all' }
  | { kind: 'branches'; ids: string[] };

export interface BranchScopeUser {
  userId?: string;
  role?: string;
  organisationId?: string;
}

// Unique query-parameter names so several scope filters can share one query.
let scopeParamSeq = 0;
const nextParam = (prefix: string) => `${prefix}_${++scopeParamSeq}`;

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
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
  ) {}

  // ── Branch scoping v2 ──────────────────────────────────────────────────────

  // Which branches this user may read/act on. 'all' when there is nothing to
  // isolate: no organisation context, patient visibility not 'isolated', an
  // org-wide role, or an org with no branches (NULL-branch rows are then the
  // normal case — Q1). Otherwise the user's active assignments to live
  // branches; an empty list is deliberate and matches nothing (fail closed).
  async scopeFor(user: BranchScopeUser): Promise<BranchScope> {
    const { userId, role, organisationId } = user;
    if (!organisationId) return { kind: 'all' };
    const settings = await this.organisationSettingsService.getOrCreate(organisationId);
    if (settings.patientVisibility !== PatientVisibility.ISOLATED) return { kind: 'all' };
    if (role && ORG_WIDE_ROLES.has(role)) return { kind: 'all' };
    const branchCount = await this.branchesRepository.count({
      where: { organisationId, deletedAt: IsNull() },
    });
    if (branchCount === 0) return { kind: 'all' };

    const assigned = (await this.resolveViaAssignments(userId, organisationId, role)) ?? [];
    if (assigned.length === 0) return { kind: 'branches', ids: [] };
    // Assignments can outlive their branch (soft-deleted branch) — never scope to one.
    const live = await this.branchesRepository.find({
      where: { id: In(assigned), organisationId, deletedAt: IsNull() },
      select: ['id'],
    });
    return { kind: 'branches', ids: live.map((b) => b.id) };
  }

  // Restrict a query to the scope. For a restricted user NULL-branch rows are
  // excluded (Q1: unassigned legacy rows are owner/admin/manager-only).
  applyBranchScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    column: string,
    scope: BranchScope,
  ): SelectQueryBuilder<T> {
    if (scope.kind === 'all') return qb;
    if (scope.ids.length === 0) return qb.andWhere('1 = 0');
    const param = nextParam('scopeBranchIds');
    return qb.andWhere(`${column} IN (:...${param})`, { [param]: scope.ids });
  }

  // Patient-linked records (medical records, prescriptions, lab reports,
  // vitals, newborn assessments, patient documents): the patient's branch is
  // the record's branch. `patientAlias` must already be joined.
  applyPatientBranchScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    patientAlias: string,
    scope: BranchScope,
  ): SelectQueryBuilder<T> {
    return this.applyBranchScope(qb, `${patientAlias}.branchId`, scope);
  }

  // The branch switcher: a view preference applied after scope. A requested
  // branch outside the scope matches nothing — it can narrow, never widen.
  narrowToSelectedBranch<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    column: string,
    requestedBranchId: string | null | undefined,
    scope: BranchScope,
  ): SelectQueryBuilder<T> {
    if (!requestedBranchId) return qb;
    if (scope.kind === 'branches' && !scope.ids.includes(requestedBranchId)) {
      return qb.andWhere('1 = 0');
    }
    const param = nextParam('selectedBranchId');
    return qb.andWhere(`${column} = :${param}`, { [param]: requestedBranchId });
  }

  // Single record / any action on it. 404, not 403, so record ids can't be
  // probed for existence across branches (Q2). NULL branch is outside a
  // restricted scope (Q1).
  assertBranchAccess(
    scope: BranchScope,
    branchId: string | null | undefined,
    notFoundMessage = 'Not found',
  ): void {
    if (scope.kind === 'all') return;
    if (!branchId || !scope.ids.includes(branchId)) {
      throw new NotFoundException(notFoundMessage);
    }
  }

  // Anything reached through a patient id (creating a clinical record, a
  // bill, an appointment, a check-in; listing by patientId): the patient must
  // be in the organisation and inside the scope. Returns the patient.
  async assertPatientAccess(
    scope: BranchScope,
    organisationId: string,
    patientId: string,
    manager?: EntityManager,
  ): Promise<Patient> {
    const repo = manager ? manager.getRepository(Patient) : this.patientsRepository;
    const patient = await repo.findOne({ where: { id: patientId, organisationId } });
    if (!patient) throw new NotFoundException('Patient not found');
    this.assertBranchAccess(scope, patient.branchId, 'Patient not found');
    return patient;
  }

  // The branch a new record is written to. A client-supplied branchId is a
  // request, never trusted on its own:
  //  - parent given (patient / room / booking / admission / bill): the
  //    parent's branch wins; a conflicting request is rejected; the parent
  //    must be inside the scope.
  //  - org with no branches: NULL.
  //  - requested: must be a live, approved branch of the org, inside scope
  //    (403 otherwise — same as inventory's resolveBranchIdForWrite).
  //  - nothing requested: the user's single usable branch, else 400 (Q3) —
  //    never a silently chosen default, never NULL in an org with branches.
  async resolveWriteBranch(
    scope: BranchScope,
    organisationId: string,
    opts: { requested?: string | null; parent?: { branchId: string | null } },
  ): Promise<string | null> {
    const { requested, parent } = opts;

    if (parent) {
      if (requested && parent.branchId && requested !== parent.branchId) {
        throw new BadRequestException('Branch does not match the record it belongs to');
      }
      this.assertBranchAccess(scope, parent.branchId);
      return parent.branchId;
    }

    const usable = await this.branchesRepository.find({
      where: { organisationId, deletedAt: IsNull(), approvalStatus: 'approved' },
      select: ['id'],
    });
    const liveCount = await this.branchesRepository.count({
      where: { organisationId, deletedAt: IsNull() },
    });
    if (liveCount === 0) return null;

    if (requested) {
      if (!usable.some((b) => b.id === requested)) {
        throw new BadRequestException('Branch not found for this organisation');
      }
      if (scope.kind === 'branches' && !scope.ids.includes(requested)) {
        throw new ForbiddenException('You do not have access to this branch');
      }
      return requested;
    }

    const candidates = usable
      .map((b) => b.id)
      .filter((id) => scope.kind === 'all' || scope.ids.includes(id));
    if (candidates.length === 1) return candidates[0];
    throw new BadRequestException(
      candidates.length === 0 ? 'You are not assigned to any branch' : 'Select a branch',
    );
  }

  // ── end v2 ─────────────────────────────────────────────────────────────────

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

  // ADR-005 Step 4 — a `null` from resolveVisibleBranchIdsForInventory is
  // ambiguous on its own: it means EITHER "this org isn't per-branch"
  // (any requested branch filter must be ignored entirely) OR "this org
  // IS per-branch but the caller holds an org-wide role" (a requested
  // filter should still be honored -- an OWNER/MANAGER explicitly
  // switching to one branch must see that branch, not everything, or the
  // branch switcher becomes a no-op for exactly the roles most likely to
  // use it). Callers that need to tell these apart (InventoryService's
  // read paths) call this first.
  async isInventoryPerBranch(organisationId: string): Promise<boolean> {
    const settings = await this.organisationSettingsService.getOrCreate(organisationId);
    return settings.inventoryPolicy === InventoryPolicy.PER_BRANCH;
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
