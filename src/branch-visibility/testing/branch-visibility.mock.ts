// Test double for BranchVisibilityService's branch-scoping v2 API with an
// unrestricted ('all') scope — an owner-like caller. For unit tests of
// services whose own behaviour (org checks, audit, validation) is under test;
// branch isolation itself is covered by branch-visibility.service.spec.ts and
// test/branch-isolation.e2e-spec.ts.
export const unrestrictedBranchVisibilityMock = (): any => ({
  scopeFor: jest.fn(async () => ({ kind: 'all' })),
  scopeForOrganisation: jest.fn(async () => ({ kind: 'all' })),
  applyBranchScope: jest.fn((qb: any) => qb),
  applyPatientBranchScope: jest.fn((qb: any) => qb),
  narrowToSelectedBranch: jest.fn((qb: any) => qb),
  assertBranchAccess: jest.fn(),
  assertPatientAccess: jest.fn(async (_s: any, _o: any, patientId: string) => ({ id: patientId })),
  resolveWriteBranch: jest.fn(async (_s: any, _o: any, opts: any) => opts?.parent?.branchId ?? opts?.requested ?? null),
  resolveVisibleBranchIds: jest.fn(async () => null),
});
