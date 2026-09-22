import { Logger } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AUDIT_FIELD_POLICY } from './audit-field-policy';

// Audit Contract invariants -- see
// scope/Audit_Trail_Accountability_Scope_v4.md "Audit Contract" and
// scope/Audit_Trail_Phase1_Auth_Implementation_Plan.md test #7. These are
// tested directly against AuditService, not through Auth, since the
// invariants apply to every future module the same way.

const baseParams = {
  organisationId: 'org-1',
  orgType: 'CLINIC' as const,
  entityType: 'auth_session',
  entityId: 'e-1',
  action: 'login' as const,
  severity: 'normal' as const,
  actorUserId: 'u-1',
  source: 'api' as const,
};

const makeService = () => {
  const saved: any[] = [];
  const makeRepo = () => ({
    create: jest.fn((entry: any) => entry),
    save: jest.fn((entry: any) => {
      saved.push(entry);
      return Promise.resolve(entry);
    }),
  });
  const auditRepo = makeRepo();
  const service = new AuditService(auditRepo as any);
  return { service, auditRepo, saved };
};

describe('AuditService.record — actor/source invariant', () => {
  it('throws when actorUserId is null and source is not system', async () => {
    const { service } = makeService();
    await expect(
      service.record({ ...baseParams, actorUserId: null, source: 'api' }),
    ).rejects.toThrow(/actorUserId is null/);
  });

  it('allows actorUserId null when source is system', async () => {
    const { service, saved } = makeService();
    await service.record({ ...baseParams, actorUserId: null, source: 'system' });
    expect(saved).toHaveLength(1);
  });

  // Real bug, found in review: the original invariant only permitted a
  // null actor for source === 'system', which meant every real Phase 1
  // call site for an unresolvable identifier (login_failed,
  // otp_request_failed, otp_verify_failed, otp_verified — see
  // auth.service.ts) threw here instead of letting the intended
  // 401/404 reach the caller. auth.service.spec.ts couldn't catch this
  // because it mocks AuditService entirely -- this suite is the only
  // place these call sites are exercised against the real record().
  it.each(['login_failed', 'otp_request_failed', 'otp_verify_failed', 'otp_verified'])(
    'allows actorUserId null for the anonymous action %s from a non-system source',
    async (action) => {
      const { service, saved } = makeService();
      await service.record({ ...baseParams, action: action as any, actorUserId: null, source: 'api' });
      expect(saved).toHaveLength(1);
    },
  );

  it('still throws for a non-anonymous action with a null actor from a non-system source', async () => {
    const { service } = makeService();
    await expect(
      service.record({ ...baseParams, action: 'login', actorUserId: null, source: 'api' }),
    ).rejects.toThrow(/actorUserId is null/);
  });
});

describe('AuditService.record — field policy (fail closed)', () => {
  it('drops changes entirely for an entity with no AUDIT_FIELD_POLICY entry', async () => {
    const { service, saved } = makeService();
    await service.record({
      ...baseParams,
      entityType: 'entity_with_no_policy',
      changes: { someField: { from: 'a', to: 'b' } },
    });
    expect(saved[0].changes).toBeNull();
  });

  it('filters changes down to the allowlist for an entity with a policy', async () => {
    // Fixture policy -- Phase 1 (Auth) doesn't generically diff any real
    // entity, so this proves the filtering mechanism itself, the way
    // scope/Audit_Trail_Phase1_Auth_Implementation_Plan.md's test #7
    // calls for. Phase 3 (Patients) adds real entries the same way.
    AUDIT_FIELD_POLICY['__test_fixture__'] = {
      allowed: ['firstName'],
      neverInclude: ['passwordHash'],
    };
    try {
      const { service, saved } = makeService();
      await service.record({
        ...baseParams,
        entityType: '__test_fixture__',
        changes: {
          firstName: { from: 'A', to: 'B' },
          notAllowed: { from: 1, to: 2 },
          passwordHash: { from: 'x', to: 'y' }, // would also be in `allowed`-adjacent data in a real bug
        },
      });
      expect(saved[0].changes).toEqual({ firstName: { from: 'A', to: 'B' } });
    } finally {
      delete AUDIT_FIELD_POLICY['__test_fixture__'];
    }
  });

  // Phase 2 (CRM): the real, non-fixture entries. See
  // scope/Audit_Trail_Phase2_CRM_Migration_Implementation_Plan.md "The
  // regression this phase must not introduce" -- this is the test that
  // would have caught it if CrmLead/CrmRequirement had shipped without
  // policy entries (everything silently dropping to null), or with an
  // incomplete one (a real UpdateLeadDto field silently dropped).
  it('CrmLead (entityType "lead"): an UpdateLeadDto field survives, an unknown field does not', async () => {
    const { service, saved } = makeService();
    await service.record({
      ...baseParams,
      entityType: 'lead',
      changes: {
        name: { from: 'Old', to: 'New' },
        lostReason: { from: null, to: 'Chose a competitor' },
        telecaller: { from: 'u-1', to: 'u-2' },
        notAFieldOnTheDto: { from: 1, to: 2 },
      },
    });
    expect(saved[0].changes).toEqual({
      name: { from: 'Old', to: 'New' },
      lostReason: { from: null, to: 'Chose a competitor' },
      telecaller: { from: 'u-1', to: 'u-2' },
    });
  });

  it('CrmRequirement (entityType "requirement"): an UpdateRequirementDto field survives, an unknown field does not', async () => {
    const { service, saved } = makeService();
    await service.record({
      ...baseParams,
      entityType: 'requirement',
      changes: {
        bedCount: { from: 10, to: 20 },
        notAFieldOnTheDto: { from: 1, to: 2 },
      },
    });
    expect(saved[0].changes).toEqual({ bedCount: { from: 10, to: 20 } });
  });

  // Phase 3 (Patients): the real, non-fixture entry, keyed 'patient' not
  // 'Patient' -- see
  // scope/Audit_Trail_Phase3_Patients_Implementation_Plan.md's field
  // policy section. This is the test that would catch a repeat of the
  // Phase 2 CrmLead-vs-'lead' key-mismatch bug for Patients specifically.
  it('patient (entityType "patient"): a real field survives, an unknown field does not', async () => {
    const { service, saved } = makeService();
    await service.record({
      ...baseParams,
      entityType: 'patient',
      changes: {
        medicalHistory: { from: 'None', to: 'Diabetes' },
        notAFieldOnTheEntity: { from: 1, to: 2 },
      },
    });
    expect(saved[0].changes).toEqual({ medicalHistory: { from: 'None', to: 'Diabetes' } });
  });
});

describe('AuditService.record — critical severity without a transaction', () => {
  it('logs a warning but still writes the row', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, saved } = makeService();
    await service.record({ ...baseParams, severity: 'critical' }); // no manager passed
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("severity 'critical'"));
    expect(saved).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it('does not warn when a manager is provided', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service } = makeService();
    const managerRepo = { create: jest.fn((e: any) => e), save: jest.fn((e: any) => Promise.resolve(e)) };
    const manager = { getRepository: jest.fn(() => managerRepo) };
    await service.record({ ...baseParams, severity: 'critical' }, manager as any);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("severity 'critical'"));
    expect(managerRepo.save).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
