import { PatientsService } from './patients.service';

// Phase 3 audit instrumentation -- see
// scope/Audit_Trail_Phase3_Patients_Implementation_Plan.md "Tests for
// this phase" (tests #1's first half, #2, #4, #5, #6; #1's second half
// -- the promoteEnquiry() creation path -- and #3 -- the field-policy key
// match -- live in retreat.service.spec.ts and audit.service.spec.ts
// respectively, matching where each behavior actually lives).

const patient = {
  id: 'p-1',
  organisationId: 'org-1',
  branchId: 'branch-1',
  patientCode: 'P00001',
  fileNumber: null,
  firstName: 'Old',
  lastName: 'Name',
  dateOfBirth: null,
  gender: null,
  phone: null,
  email: null,
  address: null,
  emergencyContact: null,
  bloodGroup: null,
  allergies: null,
  medicalHistory: null,
  motherPatientId: null,
  createdBy: null,
  updatedBy: null,
};

const makeService = (overrides: {
  findOnePatient?: any;
  managerUpdate?: jest.Mock;
  auditRecord?: jest.Mock;
} = {}) => {
  const patientsRepository: any = {
    findOne: jest.fn(() => Promise.resolve(overrides.findOnePatient ?? null)),
    count: jest.fn(() => Promise.resolve(0)),
    create: jest.fn((x: any) => x),
    save: jest.fn((p: any) => Promise.resolve(p)),
    createQueryBuilder: jest.fn(() => ({
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(() => Promise.resolve(overrides.findOnePatient ?? null)),
    })),
    manager: {
      transaction: jest.fn((cb: any) =>
        cb({
          getRepository: jest.fn(() => ({
            softDelete: overrides.managerUpdate ?? jest.fn(() => Promise.resolve()),
          })),
        }),
      ),
    },
  };
  const branchesRepository: any = { findOne: jest.fn(() => Promise.resolve({ id: 'branch-2' })) };
  const branchVisibilityService: any = { resolveVisibleBranchIds: jest.fn(() => Promise.resolve(null)) };
  const auditService: any = { record: overrides.auditRecord ?? jest.fn(() => Promise.resolve()) };

  const service = new PatientsService(
    patientsRepository, branchesRepository, branchVisibilityService, auditService,
  );
  return { service, patientsRepository, auditService, branchVisibilityService };
};

describe('PatientsService.create — audit event', () => {
  it('records action=create with the actor and no changes diff', async () => {
    const { service, auditService } = makeService();
    await service.create('u-1', 'OWNER', 'org-1', 'CLINIC', {
      firstName: 'A', lastName: 'B',
    } as any);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'patient', action: 'create', severity: 'sensitive', actorUserId: 'u-1',
      }),
    );
  });
});

describe('PatientsService.findOne — view event', () => {
  it('records action=view only after authorization succeeds', async () => {
    const { service, auditService } = makeService({ findOnePatient: { ...patient } });
    await service.findOne('p-1', 'u-1', 'OWNER', 'org-1', 'CLINIC');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'view', severity: 'sensitive', actorUserId: 'u-1' }),
    );
  });

  it('does not record a view event when authorization fails', async () => {
    const { service, auditService } = makeService({ findOnePatient: { ...patient } });
    await expect(
      service.findOne('p-1', 'u-1', 'OWNER', 'org-other', 'CLINIC'),
    ).rejects.toThrow();
    expect(auditService.record).not.toHaveBeenCalled();
  });
});

describe('PatientsService.update — before/after diff', () => {
  it('records only fields that actually changed, using entity field names', async () => {
    const { service, auditService } = makeService({ findOnePatient: { ...patient } });
    await service.update('p-1', 'u-1', 'OWNER', 'org-1', 'CLINIC', {
      firstName: 'New', // changed
      lastName: 'Name',  // same as before -- must NOT appear in the diff
      patientId: 'P00002', // DTO alias -> entity's patientCode
    } as any);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        severity: 'sensitive',
        changes: {
          firstName: { from: 'Old', to: 'New' },
          patientCode: { from: 'P00001', to: 'P00002' },
        },
      }),
    );
  });

  it('emits no audit event when the update is a true no-op', async () => {
    const { service, auditService } = makeService({ findOnePatient: { ...patient } });
    await service.update('p-1', 'u-1', 'OWNER', 'org-1', 'CLINIC', {
      firstName: 'Old', // identical to current value
    } as any);
    expect(auditService.record).not.toHaveBeenCalled();
  });
});

describe('PatientsService.remove — critical transaction + view/delete pair', () => {
  it('emits both a view event (from the internal findOne) and a soft_delete event', async () => {
    const { service, auditService } = makeService({ findOnePatient: { ...patient } });
    await service.remove('p-1', 'u-1', 'OWNER', 'org-1', 'CLINIC');

    const actions = auditService.record.mock.calls.map((c: any) => c[0].action);
    expect(actions).toEqual(['view', 'soft_delete']);
    expect(auditService.record.mock.calls[1][0]).toMatchObject({ severity: 'critical' });
    // soft_delete is the transactional call -- second positional arg is the manager
    expect(auditService.record.mock.calls[1][1]).toBeDefined();
  });

  it('propagates an audit-insert failure so softDelete does not commit alone', async () => {
    const managerUpdate = jest.fn(() => Promise.resolve());
    const auditRecord = jest.fn()
      .mockResolvedValueOnce(undefined) // the view event from findOne()
      .mockRejectedValueOnce(new Error('audit write failed')); // the soft_delete event
    const { service } = makeService({ findOnePatient: { ...patient }, managerUpdate, auditRecord });

    await expect(
      service.remove('p-1', 'u-1', 'OWNER', 'org-1', 'CLINIC'),
    ).rejects.toThrow('audit write failed');
    expect(managerUpdate).toHaveBeenCalledWith('p-1');
  });
});

// Phone is a contact attribute, not identity -- see
// scope/patient-phone-non-unique-and-matching.md.
describe('PatientsService — shared phone numbers', () => {
  it('create() saves a patient whose phone another patient already has', async () => {
    const { service, patientsRepository } = makeService({
      findOnePatient: { ...patient, id: 'p-other', phone: '6238154525' },
    });
    await expect(
      service.create('u-1', 'RECEPTIONIST', 'org-1', 'CLINIC', {
        firstName: 'A', lastName: 'B', phone: '6238154525',
      } as any),
    ).resolves.toMatchObject({ phone: '6238154525' });
    expect(patientsRepository.save).toHaveBeenCalled();
  });

  it('findVisibleByPhone() returns nothing for non-CLINIC callers or a blank phone', async () => {
    const { service, patientsRepository } = makeService();
    await expect(service.findVisibleByPhone('u-1', 'SUPER_ADMIN', 'org-t', 'AYURLAHI_TEAM', '6238154525')).resolves.toEqual([]);
    await expect(service.findVisibleByPhone('u-1', 'OWNER', 'org-1', 'CLINIC', '   ')).resolves.toEqual([]);
    expect(patientsRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('findVisibleByPhone() applies org + branch visibility and an exact trimmed phone match', async () => {
    const { service, patientsRepository, branchVisibilityService } = makeService();
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(() => Promise.resolve([{ id: 'p-1' }])),
    };
    patientsRepository.createQueryBuilder.mockReturnValue(qb);
    branchVisibilityService.resolveVisibleBranchIds.mockResolvedValue(['branch-b']);

    await expect(
      service.findVisibleByPhone('u-1', 'RECEPTIONIST', 'org-1', 'CLINIC', ' 6238154525 '),
    ).resolves.toEqual([{ id: 'p-1' }]);
    expect(qb.where).toHaveBeenCalledWith('patient.organisationId = :organisationId', { organisationId: 'org-1' });
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(patient.branchId IS NULL OR patient.branchId IN (:...visibleBranchIds))',
      { visibleBranchIds: ['branch-b'] },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('patient.phone = :phone', { phone: '6238154525' });
  });
});
