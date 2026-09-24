import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CashGoLiveService } from './cash-go-live.service';

// Permission and "already live" checks. The full go-live path (advances,
// opening journal, atomic activation) is covered by the staging end-to-end run.
describe('CashGoLiveService — who can do what', () => {
  const tx = jest.fn();
  const svc = new CashGoLiveService({ manager: { query: jest.fn(() => Promise.resolve([])) }, transaction: tx } as any, {} as any, {} as any);
  const who = (role: string, organisationType = 'CLINIC') => ({ userId: 'u', organisationId: 'org', organisationType, role });

  it.each(['RECEPTIONIST', 'MANAGER', 'STAFF', 'NURSE'])('%s cannot seed, preview or go live', async (role) => {
    await expect(svc.seed(who(role))).rejects.toThrow(ForbiddenException);
    await expect(svc.preview(who(role), [])).rejects.toThrow(ForbiddenException);
    await expect(svc.confirm(who(role), [])).rejects.toThrow(ForbiddenException);
    expect(tx).not.toHaveBeenCalled();
  });

  it('non-clinic organisations get nothing, not even status', async () => {
    await expect(svc.status(who('OWNER', 'MANUFACTURER'))).rejects.toThrow(ForbiddenException);
    await expect(svc.receivingLedgers(who('OWNER', 'MANUFACTURER'))).rejects.toThrow(ForbiddenException);
    await expect(svc.confirm(who('OWNER', 'MANUFACTURER'), [])).rejects.toThrow(ForbiddenException);
  });

  it("403 messages avoid the words that force the app to log out", async () => {
    const e = await svc.confirm(who('RECEPTIONIST'), []).catch((x) => x);
    expect(e.message).not.toMatch(/deactivat|account|revoked/i);
  });

  it('refuses a second go-live without writing anything', async () => {
    const query = jest.fn((sql: string) => Promise.resolve(sql.includes('FOR UPDATE') ? [{ live_from: '2026-09-24', enabled: true }] : []));
    const s2 = new CashGoLiveService({ transaction: (cb: any) => cb({ query }) } as any, {} as any, {} as any);
    await expect(s2.confirm(who('OWNER'), [])).rejects.toThrow(ConflictException);
    expect(query.mock.calls.some(([sql]) => /UPDATE organisation_settings/.test(sql))).toBe(false);
  });

  // Rollout control: until Ayurlahi sets cash_module_enabled, even the owner
  // cannot seed, preview or go live -- and nothing is written.
  it.each(['OWNER', 'ADMIN'])('%s cannot set up cash tracking before Ayurlahi enables it', async (role) => {
    const query = jest.fn((sql: string) => Promise.resolve(sql.includes('FOR UPDATE') ? [{ live_from: null, enabled: false }] : [{ enabled: false }]));
    const transaction = jest.fn((cb: any) => cb({ query }));
    const s3 = new CashGoLiveService({ manager: { query }, transaction } as any, { seedPaymentLedgers: jest.fn() } as any, {} as any);
    await expect(s3.seed(who(role))).rejects.toThrow(ForbiddenException);
    await expect(s3.preview(who(role), [])).rejects.toThrow(ForbiddenException);
    await expect(s3.confirm(who(role), [])).rejects.toThrow(ForbiddenException);
    expect(query.mock.calls.some(([sql]) => /^\s*(UPDATE|INSERT)/.test(sql))).toBe(false);
    const e = await s3.seed(who(role)).catch((x) => x);
    expect(e.message).not.toMatch(/deactivat|account|revoked/i);
  });

  it('status reports whether Ayurlahi has enabled cash tracking', async () => {
    const s4 = new CashGoLiveService({ manager: { query: jest.fn(() => Promise.resolve([{ live_from: null, enabled: true, ledgers: 0 }])) } } as any, {} as any, {} as any);
    await expect(s4.status(who('RECEPTIONIST'))).resolves.toEqual({ liveFrom: null, enabled: true, ledgersSeeded: false });
  });
});
