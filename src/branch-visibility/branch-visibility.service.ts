import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../staff/entities/staff.entity';
import { StaffBranchAssignment } from '../staff-branch-assignments/entities/staff-branch-assignment.entity';
import { OrganisationSettingsService } from '../organisation-settings/organisation-settings.service';
import { PatientVisibility } from '../organisation-settings/entities/organisation-settings.entity';

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
    if (settings.patientVisibility !== PatientVisibility.ISOLATED) {
      return null;
    }

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
}
