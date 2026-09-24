import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BranchScope, BranchVisibilityService } from './branch-visibility.service';
import { PatientVisibility } from '../organisation-settings/entities/organisation-settings.entity';

// Branch scoping v2 — scope/Branch_Scoping_Remediation_Plan_2026-09-24.md §10 (Q1–Q3), §11.
// Unit level only; the real-DB contract suite is test/branch-isolation.e2e-spec.ts.

const A = 'branch-a';
const B = 'branch-b';

const make = (opts: {
  visibility?: PatientVisibility;
  liveBranches?: { id: string; approvalStatus?: string }[];
  staff?: { id: string } | null;
  assignments?: string[];
  patient?: { id: string; branchId: string | null } | null;
} = {}) => {
  const live = opts.liveBranches ?? [{ id: A }, { id: B }];
  const settings = { getOrCreate: jest.fn(async () => ({ patientVisibility: opts.visibility ?? PatientVisibility.ISOLATED })) };
  const staffRepo = { findOne: jest.fn(async () => (opts.staff === undefined ? { id: 'staff-1' } : opts.staff)) };
  const assignmentsRepo = { find: jest.fn(async () => (opts.assignments ?? []).map((branchId) => ({ branchId }))) };
  const branchesRepo = {
    count: jest.fn(async () => live.length),
    find: jest.fn(async ({ where }: any) => {
      let rows = live.map((b) => ({ approvalStatus: 'approved', ...b }));
      if (where?.approvalStatus) rows = rows.filter((b) => b.approvalStatus === where.approvalStatus);
      if (where?.id?._value) rows = rows.filter((b) => where.id._value.includes(b.id));
      return rows.map((b) => ({ id: b.id }));
    }),
  };
  const patientsRepo = { findOne: jest.fn(async () => opts.patient ?? null) };
  const service = new BranchVisibilityService(settings as any, staffRepo as any, assignmentsRepo as any, branchesRepo as any, patientsRepo as any);
  return { service, patientsRepo };
};

const restrictedA = { userId: 'u1', role: 'RECEPTIONIST', organisationId: 'org' };
const qbMock = () => {
  const calls: any[] = [];
  const qb: any = { andWhere: jest.fn((sql: string, params?: any) => { calls.push([sql, params]); return qb; }) };
  return { qb, calls };
};

describe('BranchVisibilityService.scopeFor', () => {
  it('is all for org-wide roles, shared orgs, no org, and orgs with no branches', async () => {
    expect(await make({ assignments: [A] }).service.scopeFor({ ...restrictedA, role: 'MANAGER' })).toEqual({ kind: 'all' });
    expect(await make({ visibility: PatientVisibility.SHARED }).service.scopeFor(restrictedA)).toEqual({ kind: 'all' });
    expect(await make().service.scopeFor({ ...restrictedA, organisationId: undefined })).toEqual({ kind: 'all' });
    expect(await make({ liveBranches: [] }).service.scopeFor(restrictedA)).toEqual({ kind: 'all' });
  });

  it('is all for Ayurlahi platform roles', async () => {
    expect(await make({ assignments: [] }).service.scopeFor({ ...restrictedA, role: 'SUPER_ADMIN' })).toEqual({ kind: 'all' });
    expect(await make({ assignments: [] }).service.scopeFor({ ...restrictedA, role: 'SUPPORT' })).toEqual({ kind: 'all' });
  });

  it('scopeForOrganisation refuses a URL organisation other than the caller\'s (platform roles pass)', async () => {
    await expect(make().service.scopeForOrganisation(restrictedA, 'other-org')).rejects.toThrow(ForbiddenException);
    await expect(make({ assignments: [A] }).service.scopeForOrganisation(restrictedA, 'org')).resolves.toEqual({ kind: 'branches', ids: [A] });
    await expect(make().service.scopeForOrganisation({ ...restrictedA, role: 'SUPER_ADMIN' }, 'other-org')).resolves.toEqual({ kind: 'all' });
  });

  it('is the live assigned branches for restricted staff, empty when unassigned or no staff row', async () => {
    expect(await make({ assignments: [A] }).service.scopeFor(restrictedA)).toEqual({ kind: 'branches', ids: [A] });
    expect(await make({ assignments: [] }).service.scopeFor(restrictedA)).toEqual({ kind: 'branches', ids: [] });
    expect(await make({ staff: null }).service.scopeFor(restrictedA)).toEqual({ kind: 'branches', ids: [] });
  });

  it('drops assignments to deleted branches', async () => {
    expect(await make({ liveBranches: [{ id: A }], assignments: [A, 'deleted-branch'] }).service.scopeFor(restrictedA))
      .toEqual({ kind: 'branches', ids: [A] });
  });
});

describe('BranchVisibilityService query helpers', () => {
  const { service } = make();

  it('applyBranchScope: all adds nothing; restricted is IN (ids) with NULL excluded (Q1); empty matches nothing', () => {
    let m = qbMock(); service.applyBranchScope(m.qb, 'p.branchId', { kind: 'all' }); expect(m.calls).toEqual([]);
    m = qbMock(); service.applyBranchScope(m.qb, 'p.branchId', { kind: 'branches', ids: [A] });
    expect(m.calls[0][0]).toMatch(/^p\.branchId IN \(:\.\.\.scopeBranchIds_\d+\)$/);
    expect(Object.values(m.calls[0][1])).toEqual([[A]]);
    expect(m.calls[0][0]).not.toMatch(/NULL/);
    m = qbMock(); service.applyBranchScope(m.qb, 'p.branchId', { kind: 'branches', ids: [] }); expect(m.calls[0][0]).toBe('1 = 0');
  });

  it('applyPatientBranchScope filters on the joined patient branch', () => {
    const m = qbMock(); service.applyPatientBranchScope(m.qb, 'patient', { kind: 'branches', ids: [A] });
    expect(m.calls[0][0]).toMatch(/^patient\.branchId IN/);
  });

  it('narrowToSelectedBranch narrows inside scope and never widens outside it', () => {
    let m = qbMock(); service.narrowToSelectedBranch(m.qb, 'p.branchId', undefined, { kind: 'branches', ids: [A] }); expect(m.calls).toEqual([]);
    m = qbMock(); service.narrowToSelectedBranch(m.qb, 'p.branchId', A, { kind: 'branches', ids: [A] });
    expect(m.calls[0][0]).toMatch(/^p\.branchId = :selectedBranchId_\d+$/);
    m = qbMock(); service.narrowToSelectedBranch(m.qb, 'p.branchId', B, { kind: 'branches', ids: [A] }); expect(m.calls[0][0]).toBe('1 = 0');
    m = qbMock(); service.narrowToSelectedBranch(m.qb, 'p.branchId', B, { kind: 'all' }); expect(Object.values(m.calls[0][1])).toEqual([B]);
  });

  it('assertBranchAccess: 404 outside scope and for NULL when restricted (Q1, Q2)', () => {
    const scope: BranchScope = { kind: 'branches', ids: [A] };
    expect(() => service.assertBranchAccess(scope, A)).not.toThrow();
    expect(() => service.assertBranchAccess(scope, B)).toThrow(NotFoundException);
    expect(() => service.assertBranchAccess(scope, null)).toThrow(NotFoundException);
    expect(() => service.assertBranchAccess({ kind: 'all' }, null)).not.toThrow();
  });
});

describe('BranchVisibilityService.assertPatientAccess', () => {
  it('returns a patient inside scope; 404 for another branch, NULL branch (restricted) or unknown id', async () => {
    const scope: BranchScope = { kind: 'branches', ids: [A] };
    await expect(make({ patient: { id: 'p', branchId: A } }).service.assertPatientAccess(scope, 'org', 'p')).resolves.toMatchObject({ id: 'p' });
    await expect(make({ patient: { id: 'p', branchId: B } }).service.assertPatientAccess(scope, 'org', 'p')).rejects.toThrow(NotFoundException);
    await expect(make({ patient: { id: 'p', branchId: null } }).service.assertPatientAccess(scope, 'org', 'p')).rejects.toThrow(NotFoundException);
    await expect(make({ patient: null }).service.assertPatientAccess({ kind: 'all' }, 'org', 'p')).rejects.toThrow(NotFoundException);
  });
});

describe('BranchVisibilityService.resolveWriteBranch', () => {
  const restricted: BranchScope = { kind: 'branches', ids: [A] };
  const multi: BranchScope = { kind: 'branches', ids: [A, B] };

  it('uses the parent branch; rejects a conflicting request; parent must be in scope', async () => {
    const { service } = make();
    await expect(service.resolveWriteBranch(restricted, 'org', { parent: { branchId: A } })).resolves.toBe(A);
    await expect(service.resolveWriteBranch(restricted, 'org', { parent: { branchId: A }, requested: B })).rejects.toThrow(BadRequestException);
    await expect(service.resolveWriteBranch(restricted, 'org', { parent: { branchId: B } })).rejects.toThrow(NotFoundException);
  });

  it('returns NULL in an org with no branches', async () => {
    await expect(make({ liveBranches: [] }).service.resolveWriteBranch({ kind: 'all' }, 'org', {})).resolves.toBeNull();
  });

  it('a requested branch must exist, be approved, and be in scope (forged branchId → 403)', async () => {
    const { service } = make({ liveBranches: [{ id: A }, { id: B }, { id: 'pending', approvalStatus: 'pending' }] });
    await expect(service.resolveWriteBranch(restricted, 'org', { requested: A })).resolves.toBe(A);
    await expect(service.resolveWriteBranch(restricted, 'org', { requested: B })).rejects.toThrow(ForbiddenException);
    await expect(service.resolveWriteBranch({ kind: 'all' }, 'org', { requested: 'pending' })).rejects.toThrow(BadRequestException);
    await expect(service.resolveWriteBranch({ kind: 'all' }, 'org', { requested: 'other-org-branch' })).rejects.toThrow(BadRequestException);
  });

  it('nothing requested: the single usable branch, else 400 (Q3); never NULL in a branched org', async () => {
    await expect(make().service.resolveWriteBranch(restricted, 'org', {})).resolves.toBe(A);
    await expect(make().service.resolveWriteBranch(multi, 'org', {})).rejects.toThrow('Select a branch');
    await expect(make().service.resolveWriteBranch({ kind: 'all' }, 'org', {})).rejects.toThrow('Select a branch');
    await expect(make({ liveBranches: [{ id: A }] }).service.resolveWriteBranch({ kind: 'all' }, 'org', {})).resolves.toBe(A);
    await expect(make().service.resolveWriteBranch({ kind: 'branches', ids: [] }, 'org', {})).rejects.toThrow('not assigned to any branch');
  });
});
