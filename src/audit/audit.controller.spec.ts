import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditReadService } from './audit-read.service';
import { RolesGuard } from '../auth/guards/roles.guard';

// Tests #1-3 (see scope/Audit_Trail_ReadAPI_AdminUI_Implementation_Plan.md
// "Tests"): exercises the real RolesGuard against the real @Roles()
// metadata already attached to AuditController -- not a re-description of
// the guard's own logic, the actual decorator on the actual controller.

const makeContext = (user: any) => ({
  getHandler: () => AuditController.prototype.findAll,
  getClass: () => AuditController,
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
});

describe('AuditController authorization (decision A)', () => {
  const guard = new RolesGuard(new Reflector());

  it('denies a clinic ADMIN', () => {
    const ctx = makeContext({ role: 'ADMIN', organisationType: 'CLINIC' });
    expect(guard.canActivate(ctx as any)).toBe(false);
  });

  it('allows SUPER_ADMIN', () => {
    const ctx = makeContext({ role: 'SUPER_ADMIN', organisationType: 'AYURLAHI_TEAM' });
    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('allows SUPPORT', () => {
    const ctx = makeContext({ role: 'SUPPORT', organisationType: 'AYURLAHI_TEAM' });
    expect(guard.canActivate(ctx as any)).toBe(true);
  });
});

describe('AuditController.findOne — createdAt required (test #11)', () => {
  it('rejects with 400 and never calls the service when createdAt is missing', () => {
    const findOne = jest.fn();
    const controller = new AuditController({ findOne } as unknown as AuditReadService);

    expect(() => controller.findOne('11111111-1111-1111-1111-111111111111', undefined as any)).toThrow(
      BadRequestException,
    );
    expect(findOne).not.toHaveBeenCalled();
  });
});
