import { PrescriptionsService } from './prescriptions.service';
import { Prescription, PrescriptionStatus } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';

// Phase 4 audit instrumentation -- see
// scope/Audit_Trail_Phase4_Prescriptions_Implementation_Plan.md "Tests
// for this phase".

const prescription = {
  id: 'rx-1',
  organisationId: 'org-1',
  patientId: 'patient-1',
  appointmentId: null,
  doctorId: 'doctor-1',
  prescriptionDate: new Date('2026-09-01'),
  diagnosis: 'Seasonal allergy',
  notes: null,
  status: PrescriptionStatus.ACTIVE,
};

const existingItems = [
  { medicineName: 'Cetirizine', dosage: '10mg', frequency: 'once daily', duration: '7 days', quantity: 7, instructions: null },
];

const makeService = (overrides: {
  findOnePrescription?: any;
  managerSoftDelete?: jest.Mock;
  managerSave?: jest.Mock;
  auditRecord?: jest.Mock;
} = {}) => {
  const managerSoftDelete = overrides.managerSoftDelete ?? jest.fn(() => Promise.resolve());
  const managerSave = overrides.managerSave ?? jest.fn((_entity: any, data: any) => Promise.resolve(data));
  const auditRecord = overrides.auditRecord ?? jest.fn(() => Promise.resolve());

  const prescriptionsRepository: any = {
    findOne: jest.fn(() => Promise.resolve(overrides.findOnePrescription ?? null)),
    create: jest.fn((x: any) => x),
    save: jest.fn((p: any) => Promise.resolve(p)),
    manager: {
      transaction: jest.fn((cb: any) =>
        cb({
          getRepository: jest.fn((entity: any) => ({
            softDelete: managerSoftDelete,
          })),
          save: managerSave,
        }),
      ),
    },
  };
  const prescriptionItemsRepository: any = {
    find: jest.fn(() => Promise.resolve(existingItems)),
    create: jest.fn((x: any) => x),
    softDelete: jest.fn(() => Promise.resolve()),
  };
  const patientsRepository: any = { findOne: jest.fn(() => Promise.resolve({ id: 'patient-2', organisationId: 'org-1' })) };
  const staffRepository: any = { findOne: jest.fn(() => Promise.resolve({ id: 'doctor-2', organisationId: 'org-1' })) };
  const appointmentsRepository: any = { findOne: jest.fn(() => Promise.resolve(null)) };
  const auditService: any = { record: auditRecord };

  const service = new PrescriptionsService(
    prescriptionsRepository, prescriptionItemsRepository, patientsRepository,
    staffRepository, appointmentsRepository, auditService,
  );
  return { service, prescriptionsRepository, prescriptionItemsRepository, auditService, managerSoftDelete, managerSave };
};

describe('PrescriptionsService.create — audit event', () => {
  it('records action=create with severity=sensitive', async () => {
    const { service, auditService } = makeService();
    await service.create('u-1', 'DOCTOR', 'org-1', 'CLINIC', {
      patientId: 'patient-1', doctorId: 'doctor-1', prescriptionDate: '2026-09-01',
      diagnosis: 'Seasonal allergy', items: [{ medicineName: 'Cetirizine' }],
    } as any);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'prescription', action: 'create', severity: 'sensitive', actorUserId: 'u-1' }),
    );
  });
});

describe('PrescriptionsService.findOne — view event', () => {
  it('records action=view only after authorization succeeds', async () => {
    const { service, auditService } = makeService({ findOnePrescription: { ...prescription } });
    await service.findOne('rx-1', 'u-1', 'DOCTOR', 'org-1', 'CLINIC');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'view', severity: 'sensitive', actorUserId: 'u-1' }),
    );
  });

  it('does not record a view event when authorization fails', async () => {
    const { service, auditService } = makeService({ findOnePrescription: { ...prescription } });
    await expect(
      service.findOne('rx-1', 'u-1', 'DOCTOR', 'org-other', 'CLINIC'),
    ).rejects.toThrow();
    expect(auditService.record).not.toHaveBeenCalled();
  });
});

describe('PrescriptionsService.update — parent-field diff', () => {
  it('records only changed fields, with prescriptionDate normalized', async () => {
    const { service, auditService } = makeService({ findOnePrescription: { ...prescription } });
    await service.update('rx-1', 'u-1', 'DOCTOR', 'org-1', 'CLINIC', {
      diagnosis: 'Chronic allergy', // changed
      notes: null, // updateDto.notes undefined would be skipped; explicit null still "changes" since undefined check differs
      prescriptionDate: '2026-09-15', // changed
    } as any);

    const call = auditService.record.mock.calls.find((c: any) => c[0].action === 'update');
    expect(call[0].changes).toEqual(
      expect.objectContaining({
        diagnosis: { from: 'Seasonal allergy', to: 'Chronic allergy' },
        prescriptionDate: { from: '2026-09-01', to: '2026-09-15' },
      }),
    );
    expect(call[0].severity).toBe('critical');
  });

  it('emits no audit event when nothing actually changes', async () => {
    const { service, auditService } = makeService({ findOnePrescription: { ...prescription } });
    await service.update('rx-1', 'u-1', 'DOCTOR', 'org-1', 'CLINIC', {
      diagnosis: 'Seasonal allergy', // identical to current value
    } as any);
    expect(auditService.record).not.toHaveBeenCalled();
  });
});

describe('PrescriptionsService.update — items snapshot', () => {
  it('populates metadata.itemsBefore/itemsAfter, coexisting with a parent-field diff', async () => {
    const { service, auditService } = makeService({ findOnePrescription: { ...prescription } });
    await service.update('rx-1', 'u-1', 'DOCTOR', 'org-1', 'CLINIC', {
      status: PrescriptionStatus.DISPENSED,
      items: [{ medicineName: 'Loratadine', dosage: '10mg', quantity: 10 }],
    } as any);

    const call = auditService.record.mock.calls.find((c: any) => c[0].action === 'update');
    expect(call[0].changes).toEqual({ status: { from: 'active', to: 'dispensed' } });
    expect(call[0].metadata.itemsBefore).toEqual([
      { medicineName: 'Cetirizine', dosage: '10mg', frequency: 'once daily', duration: '7 days', quantity: 7, instructions: null },
    ]);
    expect(call[0].metadata.itemsAfter).toEqual([
      { medicineName: 'Loratadine', dosage: '10mg', frequency: null, duration: null, quantity: 10, instructions: null },
    ]);
  });
});

describe('PrescriptionsService.update — critical transaction atomicity', () => {
  it('runs the items softDelete on the transactional manager, not the injected repository', async () => {
    const { service, managerSoftDelete, prescriptionItemsRepository } = makeService({ findOnePrescription: { ...prescription } });
    await service.update('rx-1', 'u-1', 'DOCTOR', 'org-1', 'CLINIC', {
      items: [{ medicineName: 'Loratadine' }],
    } as any);
    expect(managerSoftDelete).toHaveBeenCalledWith({ prescriptionId: 'rx-1' });
    // The exact regression check: the injected (non-transactional)
    // repository's softDelete must NOT be the one actually called.
    expect(prescriptionItemsRepository.softDelete).not.toHaveBeenCalled();
  });

  it('propagates an audit-insert failure so items softDelete + prescription save do not commit alone', async () => {
    const managerSoftDelete = jest.fn(() => Promise.resolve());
    const managerSave = jest.fn((_e: any, d: any) => Promise.resolve(d));
    const auditRecord = jest.fn(() => Promise.reject(new Error('audit write failed')));
    const { service } = makeService({
      findOnePrescription: { ...prescription }, managerSoftDelete, managerSave, auditRecord,
    });

    await expect(
      service.update('rx-1', 'u-1', 'DOCTOR', 'org-1', 'CLINIC', {
        diagnosis: 'Chronic allergy', items: [{ medicineName: 'Loratadine' }],
      } as any),
    ).rejects.toThrow('audit write failed');

    expect(managerSoftDelete).toHaveBeenCalled();
    expect(managerSave).toHaveBeenCalled();
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', severity: 'critical' }),
      expect.anything(),
    );
  });
});

describe('PrescriptionsService.remove — critical transaction + view/delete pair', () => {
  it('emits view then soft_delete, soft_delete via the transactional manager', async () => {
    const { service, auditService, managerSoftDelete } = makeService({ findOnePrescription: { ...prescription } });
    await service.remove('rx-1', 'u-1', 'DOCTOR', 'org-1', 'CLINIC');

    const actions = auditService.record.mock.calls.map((c: any) => c[0].action);
    expect(actions).toEqual(['view', 'soft_delete']);
    expect(auditService.record.mock.calls[1][0].severity).toBe('critical');
    expect(managerSoftDelete).toHaveBeenCalledWith('rx-1');
  });
});
