import { ForbiddenException } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';

// SEC-7 regression: findOne/update guarded access with only
// `if (organisationType === 'CLINIC') { checkOwnership }` — any other
// organisationType (including undefined) fell through with no check at
// all, letting any authenticated user read/edit any org's medical record.
//
// PrescriptionsService and LabReportsService share this exact shape
// (findOne/update gated only on the CLINIC branch, no else) and received
// the identical fix — not re-tested here to avoid duplicating this file
// three times over for structurally identical logic.

const record = { id: 'mr-1', organisationId: 'org-clinic', patientId: 'p1', doctorId: 'd1' };

const makeService = () => {
  const medicalRecordsRepository = {
    findOne: jest.fn(() => Promise.resolve({ ...record })),
    save: jest.fn((r) => Promise.resolve(r)),
  };
  const service = new MedicalRecordsService(
    medicalRecordsRepository as any,
    {} as any, // patientsRepository
    {} as any, // staffRepository
    {} as any, // appointmentsRepository
  );
  return { service, medicalRecordsRepository };
};

describe('MedicalRecordsService.findOne — SEC-7 org-scoping', () => {
  it('CLINIC caller from the owning org can read the record', async () => {
    const { service } = makeService();
    await expect(
      service.findOne('mr-1', 'u1', 'OWNER', 'org-clinic', 'CLINIC'),
    ).resolves.toMatchObject({ id: 'mr-1' });
  });

  it('CLINIC caller from a different org is denied', async () => {
    const { service } = makeService();
    await expect(
      service.findOne('mr-1', 'u1', 'OWNER', 'org-other', 'CLINIC'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN role can read any record regardless of organisationType', async () => {
    const { service } = makeService();
    await expect(
      service.findOne('mr-1', 'u1', 'SUPER_ADMIN', undefined, undefined),
    ).resolves.toMatchObject({ id: 'mr-1' });
  });

  it('SUPPORT role can read any record regardless of organisationType', async () => {
    const { service } = makeService();
    await expect(
      service.findOne('mr-1', 'u1', 'SUPPORT', undefined, undefined),
    ).resolves.toMatchObject({ id: 'mr-1' });
  });

  it('undefined organisationType with a non-admin role is denied, not global', async () => {
    const { service } = makeService();
    await expect(
      service.findOne('mr-1', 'u1', 'OWNER', undefined, undefined),
    ).rejects.toThrow(ForbiddenException);
  });

  it('MANUFACTURER organisationType is denied — records are clinic-only', async () => {
    const { service } = makeService();
    await expect(
      service.findOne('mr-1', 'u1', 'OWNER', 'org-mfg', 'MANUFACTURER'),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('MedicalRecordsService.update — SEC-7 org-scoping (write path)', () => {
  it('CLINIC caller from a different org cannot edit the record', async () => {
    const { service } = makeService();
    await expect(
      service.update('mr-1', 'u1', 'OWNER', 'org-other', 'CLINIC', {} as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('undefined organisationType with a non-admin role cannot edit the record', async () => {
    const { service } = makeService();
    await expect(
      service.update('mr-1', 'u1', 'OWNER', undefined, undefined, {} as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('CLINIC caller from the owning org can edit the record', async () => {
    const { service, medicalRecordsRepository } = makeService();
    await service.update('mr-1', 'u1', 'OWNER', 'org-clinic', 'CLINIC', { notes: 'x' } as any);
    expect(medicalRecordsRepository.save).toHaveBeenCalled();
  });
});
