import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { OtpVerification } from '../otp/entities/otp-verification.entity';

// Phase 1 audit instrumentation -- see
// scope/Audit_Trail_Phase1_Auth_Implementation_Plan.md "Tests for this
// phase" (tests #1, #2, #3, #5, #6; #4's "JWT still valid after logout"
// half is an e2e/guard-level concern, not something a mocked-repository
// unit test can assert -- this file covers the audit-recording half only).

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(() => Promise.resolve('hashed')),
}));
const bcrypt = require('bcryptjs');

const user = {
  id: 'u-1',
  email: 'owner@cns.com',
  passwordHash: 'stored-hash',
  isActive: true,
  firstName: 'A',
  lastName: 'B',
  phone: null,
  isEmailVerified: true,
};

const noopRepo = () => ({ findOne: jest.fn(() => Promise.resolve(null)) });

const makeService = (overrides: {
  findUser?: any;
  orgUsers?: any[];
  managerUpdate?: jest.Mock;
  auditRecord?: jest.Mock;
} = {}) => {
  const usersRepository: any = {
    findOne: jest.fn(() => Promise.resolve(overrides.findUser ?? null)),
    save: jest.fn((u: any) => Promise.resolve(u)),
    manager: {
      transaction: jest.fn((cb: any) =>
        cb({ update: overrides.managerUpdate ?? jest.fn(() => Promise.resolve()) }),
      ),
    },
  };
  const organisationUsersRepository: any = {
    find: jest.fn(() => Promise.resolve(overrides.orgUsers ?? [])),
  };
  const otpRepository: any = {
    findOne: jest.fn(() =>
      Promise.resolve({
        id: 'otp-1',
        identifier: 'owner@cns.com',
        channel: 'email',
        otpHash: 'otp-hash',
        purpose: 'password_reset',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ),
    update: jest.fn(() => Promise.resolve()),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(() => Promise.resolve()),
    })),
    save: jest.fn(),
    create: jest.fn((x: any) => x),
  };
  const auditService: any = { record: overrides.auditRecord ?? jest.fn(() => Promise.resolve()) };
  const jwtService: any = { sign: jest.fn(() => 'fake-jwt') };

  const service = new AuthService(
    usersRepository,
    organisationUsersRepository,
    {} as any, // organisationsRepository
    noopRepo() as any, // staffRepository
    noopRepo() as any, // clinicCapabilitiesRepository
    noopRepo() as any, // clinicProfileRepository
    noopRepo() as any, // manufacturerProfileRepository
    noopRepo() as any, // orgContactRepository
    otpRepository,
    jwtService,
    {} as any, // notificationsService
    { sendOtp: jest.fn() } as any, // smsService
    { sendOtp: jest.fn() } as any, // emailService
    {} as any, // organisationSettingsService
    auditService,
  );
  return { service, usersRepository, organisationUsersRepository, otpRepository, auditService, jwtService };
};

describe('AuthService.login — audit events', () => {
  it('success: records action=login with the real actor', async () => {
    const { service, auditService } = makeService({ findUser: { ...user } });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await service.login({ email: user.email, password: 'x' } as any);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'login', severity: 'normal', actorUserId: 'u-1' }),
    );
  });

  it('unknown identifier: records login_failed with no actor, identifier in metadata', async () => {
    const { service, auditService } = makeService({ findUser: null });

    await expect(
      service.login({ email: 'nobody@example.com', password: 'x' } as any),
    ).rejects.toThrow(UnauthorizedException);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'login_failed',
        actorUserId: null,
        organisationId: null,
        metadata: expect.objectContaining({ reason: 'invalid_credentials', identifier: 'nobody@example.com' }),
      }),
    );
  });

  it('inactive account: records login_failed with the known actor', async () => {
    const { service, auditService } = makeService({ findUser: { ...user, isActive: false } });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({ email: user.email, password: 'x' } as any),
    ).rejects.toThrow(UnauthorizedException);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'login_failed',
        actorUserId: 'u-1',
        metadata: expect.objectContaining({ reason: 'account_inactive' }),
      }),
    );
  });
});

describe('AuthService.logout — audit event', () => {
  it('records action=logout for the authenticated actor', async () => {
    const { service, auditService } = makeService();

    const result = await service.logout('u-1', 'org-1', 'CLINIC', 'OWNER');

    expect(result).toEqual({ message: 'Logged out successfully' });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'logout', actorUserId: 'u-1', organisationId: 'org-1' }),
    );
  });
});

describe('AuthService.requestOtp — audit events', () => {
  it('unknown identifier: records otp_request_failed with no actor', async () => {
    const { service, auditService } = makeService({ findUser: null });

    await expect(
      service.requestOtp({ channel: 'email', email: 'nobody@example.com', purpose: 'login' } as any),
    ).rejects.toThrow();

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'otp_request_failed',
        actorUserId: null,
        metadata: expect.objectContaining({ identifier: 'nobody@example.com' }),
      }),
    );
  });
});

// This suite proves the CODE structure required for atomicity: the audit
// write shares the transaction callback with the password update, and a
// failure there propagates instead of being swallowed. It does NOT prove
// Postgres actually rolled back the password change -- that depends on
// TypeORM's manager.transaction() semantics, which this suite (mocked
// repositories) doesn't exercise, and no real-DB test of it has been run
// yet. A genuine rollback proof would need an e2e test (test/*.e2e-spec.ts
// already exists in this project) against a real Postgres connection --
// deliberately not added in this pass; flagged as an open follow-up.
describe('AuthService.resetPassword — audit failure propagates out of the transaction callback', () => {
  it('propagates an audit-insert failure; does NOT independently verify Postgres rollback', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const managerUpdate = jest.fn(() => Promise.resolve());
    const auditRecord = jest.fn(() => Promise.reject(new Error('audit write failed')));
    const { service } = makeService({ findUser: { ...user }, managerUpdate, auditRecord });

    await expect(
      service.resetPassword({ identifier: user.email, otp: '123456', newPassword: 'newpass123' } as any),
    ).rejects.toThrow('audit write failed');

    // The password UPDATE was issued inside the same transaction callback
    // that also threw on the audit write -- TypeORM's manager.transaction()
    // rolls back everything in that callback when it rejects, which is
    // what turns this into a real no-op in Postgres. This unit test proves
    // our code propagates the failure instead of swallowing it; it doesn't
    // re-test TypeORM's own rollback mechanics.
    expect(managerUpdate).toHaveBeenCalledWith(User, user.id, { passwordHash: 'hashed' });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'password_reset_completed', severity: 'critical' }),
      expect.anything(),
    );
  });

  it('succeeds and audits when nothing fails', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const { service, auditService } = makeService({ findUser: { ...user } });

    const result = await service.resetPassword({
      identifier: user.email, otp: '123456', newPassword: 'newpass123',
    } as any);

    expect(result).toEqual({ message: 'Password reset successfully' });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'password_reset_completed', severity: 'critical', actorUserId: 'u-1' }),
      expect.anything(),
    );
  });
});
