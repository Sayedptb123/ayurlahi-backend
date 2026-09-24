import { BadRequestException, ConflictException } from '@nestjs/common';
import { VoucherPostingService, displayVoucherNumber } from './voucher-posting.service';

// Fast checks that need no database. The database behaviour (numbering,
// triggers, rollback, composite FKs) is covered by voucher-posting.service.int-spec.ts.

const base = {
  organisationId: 'org-1',
  voucherType: 'receipt' as const,
  voucherDate: '2026-09-24',
  narration: 'Test',
  sourceType: 'money_in' as const,
  lines: [{ accountId: 'a1', debit: 100 }, { accountId: 'a2', credit: 100 }],
  createdBy: 'u-1',
};

const managerWith = (liveFrom: string | null) => ({
  query: jest.fn((sql: string) =>
    Promise.resolve(sql.includes('cash_module_live_from') ? [{ live_from: liveFrom }] : []),
  ),
});

describe('VoucherPostingService (no database)', () => {
  const service = new VoucherPostingService({ record: jest.fn() } as any);

  it('formats display numbers by type and Indian financial year', () => {
    expect(displayVoucherNumber('receipt', 2026, 1)).toBe('RV/2026-27/000001');
    expect(displayVoucherNumber('journal', 2099, 123456)).toBe('JV/2099-00/123456');
  });

  it('validates lines before any query runs', async () => {
    const m = managerWith('2026-09-01');
    await expect(service.post(m as any, { ...base, lines: [{ accountId: 'a1', debit: 1 }, { accountId: 'a2', credit: 2 }] }))
      .rejects.toThrow(BadRequestException);
    expect(m.query).not.toHaveBeenCalled();
  });

  it('balances in paise, so 0.1 + 0.2 against 0.3 is not a false mismatch', async () => {
    const m = managerWith(null);
    await expect(service.post(m as any, {
      ...base, lines: [{ accountId: 'a1', debit: 0.1 }, { accountId: 'a1', debit: 0.2 }, { accountId: 'a2', credit: 0.3 }],
    })).resolves.toBeNull();
  });

  it('returns null without writing when the module is off', async () => {
    const m = managerWith(null);
    await expect(service.post(m as any, base)).resolves.toBeNull();
    expect(m.query).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown source types and a reversal posted through post()', async () => {
    const m = managerWith('2026-09-01');
    await expect(service.post(m as any, { ...base, sourceType: 'reversal' as any })).rejects.toThrow("Unknown voucher source 'reversal'");
  });

  it('rejects an original date that is not before the voucher date', async () => {
    const m = managerWith('2026-09-01');
    await expect(service.post(m as any, { ...base, originalDate: '2026-09-24' })).rejects.toThrow('originalDate');
  });

  it('maps a lost race on the source index to 409, not 500', async () => {
    let i = 0;
    const m = {
      query: jest.fn((sql: string) => {
        if (sql.includes('cash_module_live_from')) return Promise.resolve([{ live_from: '2026-09-01' }]);
        if (sql.includes('FROM accounts')) return Promise.resolve([
          { id: 'a1', organisation_id: 'org-1', is_active: true, name: 'A1' },
          { id: 'a2', organisation_id: 'org-1', is_active: true, name: 'A2' },
        ]);
        if (sql.includes('voucher_counters')) return Promise.resolve([{ last_number: 1 }]);
        if (sql.startsWith('INSERT INTO vouchers')) {
          return Promise.reject(Object.assign(new Error('dup'), { code: '23505', constraint: 'uq_vouchers_source' }));
        }
        i++;
        return Promise.resolve([]);
      }),
    };
    await expect(service.post(m as any, { ...base, sourceType: 'patient_payment', sourceId: 's-1' }))
      .rejects.toThrow(ConflictException);
  });
});
