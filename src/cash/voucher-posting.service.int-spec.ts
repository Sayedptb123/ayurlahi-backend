import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { VoucherPostingService, PostVoucherInput } from './voucher-posting.service';

// Integration tests against a real Postgres with the cash migration applied
// (numbering under concurrency, triggers, rollback, composite FKs). Not part of
// the default `jest` run (the file name doesn't match *.spec.ts). Run with:
//
//   CASH_IT_DB_URL=postgres://<user>@localhost/cash_it \
//     npx jest --testRegex 'voucher-posting.service.int-spec.ts$'
//
// against a throwaway database built from src/migrations (baseline + dated
// files). The suite creates its own organisations and never cleans up, so
// never point it at a shared database.

const url = process.env.CASH_IT_DB_URL;
const suite = url ? describe : describe.skip;

const ORG_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORG_B = 'bbbbbbbb-0000-4000-8000-000000000001';
const ORG_OFF = 'cccccccc-0000-4000-8000-000000000001';
const USER = 'dddddddd-0000-4000-8000-000000000001';
const BRANCH_A = 'aaaaaaaa-0000-4000-8000-0000000000b1';
const BRANCH_B = 'bbbbbbbb-0000-4000-8000-0000000000b1';
const CASH_A = 'aaaaaaaa-0000-4000-8000-0000000000c1';
const INCOME_A = 'aaaaaaaa-0000-4000-8000-0000000000c2';
const SHORT_A = 'aaaaaaaa-0000-4000-8000-0000000000c3';
const OLD_A = 'aaaaaaaa-0000-4000-8000-0000000000c4';
const BANK_A = 'aaaaaaaa-0000-4000-8000-0000000000c5';
const CASH_B = 'bbbbbbbb-0000-4000-8000-0000000000c1';
const CASH_OFF = 'cccccccc-0000-4000-8000-0000000000c1';
const INCOME_OFF = 'cccccccc-0000-4000-8000-0000000000c2';

const uuid = (n: number) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, '0')}`;

suite('VoucherPostingService (integration, real Postgres)', () => {
  let ds: DataSource;
  let service: VoucherPostingService;

  const receipt = (over: Partial<PostVoucherInput> = {}): PostVoucherInput => ({
    organisationId: ORG_A,
    voucherType: 'receipt',
    voucherDate: '2026-09-24',
    narration: 'Patient payment',
    sourceType: 'money_in',
    lines: [
      { accountId: CASH_A, debit: 500, branchId: BRANCH_A },
      { accountId: INCOME_A, credit: 500, branchId: BRANCH_A },
    ],
    createdBy: USER,
    ...over,
  });
  const post = (input: PostVoucherInput) => ds.transaction((m) => service.post(m, input));
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await ds.query(sql, params))[0].count);

  beforeAll(async () => {
    ds = new DataSource({ type: 'postgres', url, entities: [AuditLog], extra: { max: 25 } });
    await ds.initialize();
    service = new VoucherPostingService(new AuditService(ds.getRepository(AuditLog)));

    await ds.query(`TRUNCATE voucher_lines, vouchers, voucher_counters, day_closes, booking_advance_receipts, accounts, partners CASCADE`);
    await ds.query(`DELETE FROM audit_logs WHERE entity_type = 'voucher'`);
    await ds.query(`DELETE FROM branches WHERE id IN ($1,$2)`, [BRANCH_A, BRANCH_B]);
    await ds.query(`DELETE FROM organisation_settings WHERE organisation_id IN ($1,$2,$3)`, [ORG_A, ORG_B, ORG_OFF]);
    await ds.query(`DELETE FROM organisations WHERE id IN ($1,$2,$3)`, [ORG_A, ORG_B, ORG_OFF]);
    await ds.query(`DELETE FROM users WHERE id = $1`, [USER]);

    await ds.query(`INSERT INTO organisations (id, name, type) VALUES ($1,'IT Org A','CLINIC'),($2,'IT Org B','CLINIC'),($3,'IT Org Off','CLINIC')`, [ORG_A, ORG_B, ORG_OFF]);
    await ds.query(`INSERT INTO users (id, first_name, last_name, phone) VALUES ($1,'IT','User','9990000001')`, [USER]);
    await ds.query(`INSERT INTO branches (id, organisation_id, name) VALUES ($1,$2,'A Main'),($3,$4,'B Main')`, [BRANCH_A, ORG_A, BRANCH_B, ORG_B]);
    await ds.query(
      `INSERT INTO organisation_settings (organisation_id, cash_module_live_from)
       VALUES ($1,'2026-09-01'),($2,'2026-09-01'),($3,NULL)`,
      [ORG_A, ORG_B, ORG_OFF],
    );
    await ds.query(
      `INSERT INTO accounts (id, organisation_id, branch_id, kind, name, is_active) VALUES
        ($1,$8,$10,'cash','Cash drawer – A Main',true),
        ($2,$8,NULL,'income','Consultation',true),
        ($3,$8,NULL,'cash_variance','Cash shortage',true),
        ($4,$8,NULL,'expense','Old head',false),
        ($5,$8,NULL,'bank','Bank – A',true),
        ($6,$9,$11,'cash','Cash drawer – B Main',true),
        ($7,$12,NULL,'cash','Cash – Off',true),
        ($13,$12,NULL,'income','Income – Off',true)`,
      [CASH_A, INCOME_A, SHORT_A, OLD_A, BANK_A, CASH_B, CASH_OFF, ORG_A, ORG_B, BRANCH_A, BRANCH_B, ORG_OFF, INCOME_OFF],
    );
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('posts a balanced voucher with number, lines and an in-transaction audit row', async () => {
    const v = await post(receipt({ sourceType: 'patient_payment', sourceId: uuid(1) }));
    expect(v).toMatchObject({ voucherType: 'receipt', voucherNumber: 1, fyStartYear: 2026, voucherDate: '2026-09-24', displayNumber: 'RV/2026-27/000001', replayed: false });
    const lines = await ds.query(`SELECT account_id, debit, credit, branch_id FROM voucher_lines WHERE voucher_id = $1 ORDER BY line_no`, [v!.id]);
    expect(lines).toEqual([
      { account_id: CASH_A, debit: '500.00', credit: '0.00', branch_id: BRANCH_A },
      { account_id: INCOME_A, debit: '0.00', credit: '500.00', branch_id: BRANCH_A },
    ]);
    expect(await count(`SELECT count(*) FROM audit_logs WHERE entity_type='voucher' AND entity_id=$1 AND severity='critical'`, [v!.id])).toBe(1);
  });

  it('rejects an unbalanced voucher before touching the database', async () => {
    await expect(post(receipt({ lines: [{ accountId: CASH_A, debit: 500 }, { accountId: INCOME_A, credit: 400 }] })))
      .rejects.toThrow('Voucher does not balance: debit 500.00, credit 400.00');
  });

  it.each([
    ['one line', [{ accountId: CASH_A, debit: 5 }], 'at least two lines'],
    ['both sides on a line', [{ accountId: CASH_A, debit: 5, credit: 5 }, { accountId: INCOME_A, credit: 0 }], 'either a debit or a credit'],
    ['three decimals', [{ accountId: CASH_A, debit: 5.001 }, { accountId: INCOME_A, credit: 5.001 }], 'at most 2 decimal places'],
    ['negative amount', [{ accountId: CASH_A, debit: -5 }, { accountId: INCOME_A, credit: -5 }], 'non-negative'],
  ])('rejects %s', async (_l, lines, msg) => {
    await expect(post(receipt({ lines: lines as any }))).rejects.toThrow(msg as string);
  });

  it("treats another organisation's ledger as not found", async () => {
    await expect(post(receipt({ lines: [{ accountId: CASH_B, debit: 5 }, { accountId: INCOME_A, credit: 5 }] })))
      .rejects.toThrow(NotFoundException);
  });

  it("treats another organisation's branch as not found", async () => {
    await expect(post(receipt({ branchId: BRANCH_B }))).rejects.toThrow('Branch not found in this organisation');
    await expect(post(receipt({ lines: [{ accountId: CASH_A, debit: 5, branchId: BRANCH_B }, { accountId: INCOME_A, credit: 5 }] })))
      .rejects.toThrow(NotFoundException);
  });

  it('rejects an inactive ledger', async () => {
    await expect(post(receipt({ lines: [{ accountId: CASH_A, credit: 5 }, { accountId: OLD_A, debit: 5 }] })))
      .rejects.toThrow('Ledger "Old head" is inactive');
  });

  it('returns the existing voucher when the same source is posted again', async () => {
    const first = await post(receipt({ sourceType: 'patient_payment', sourceId: uuid(2) }));
    const again = await post(receipt({ sourceType: 'patient_payment', sourceId: uuid(2) }));
    expect(again).toMatchObject({ id: first!.id, replayed: true });
    expect(await count(`SELECT count(*) FROM vouchers WHERE source_id=$1`, [uuid(2)])).toBe(1);
  });

  it('returns the existing voucher for a repeated idempotency key (double-tap on Save)', async () => {
    const first = await post(receipt({ idempotencyKey: uuid(3) }));
    const again = await post(receipt({ idempotencyKey: uuid(3) }));
    expect(again).toMatchObject({ id: first!.id, replayed: true });
  });

  it('posts a source only once when two requests race', async () => {
    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map(() => post(receipt({ sourceType: 'patient_payment', sourceId: uuid(4) }))),
    );
    for (const r of results) {
      if (r.status === 'rejected') expect(r.reason).toBeInstanceOf(ConflictException);
    }
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(await count(`SELECT count(*) FROM vouchers WHERE source_id=$1`, [uuid(4)])).toBe(1);
  });

  it('allocates gap-free, unique numbers under 20 concurrent posts', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        post(receipt({ voucherType: 'contra', voucherDate: '2030-05-01', lines: [{ accountId: BANK_A, debit: 1 }, { accountId: CASH_A, credit: 1 }] })),
      ),
    );
    const numbers = results.map((v) => v!.voucherNumber).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('leaves no voucher and no used number when the caller rolls back', async () => {
    await expect(
      ds.transaction(async (m) => {
        await service.post(m, receipt({ voucherType: 'journal', voucherDate: '2031-05-01', sourceType: 'expense', sourceId: uuid(5) }));
        throw new Error('source write failed');
      }),
    ).rejects.toThrow('source write failed');
    expect(await count(`SELECT count(*) FROM vouchers WHERE source_id=$1`, [uuid(5)])).toBe(0);
    const next = await post(receipt({ voucherType: 'journal', voucherDate: '2031-05-01' }));
    expect(next!.voucherNumber).toBe(1);
  });

  it('numbers each Indian financial year separately (31 Mar vs 1 Apr)', async () => {
    const mar = await post(receipt({ voucherType: 'payment', voucherDate: '2033-03-31', lines: [{ accountId: INCOME_A, debit: 1 }, { accountId: CASH_A, credit: 1 }] }));
    const apr = await post(receipt({ voucherType: 'payment', voucherDate: '2033-04-01', lines: [{ accountId: INCOME_A, debit: 1 }, { accountId: CASH_A, credit: 1 }] }));
    expect([mar!.displayNumber, apr!.displayNumber]).toEqual(['PV/2032-33/000001', 'PV/2033-34/000001']);
  });

  describe('reversals', () => {
    it('posts a reversal with swapped lines, dated today, linked to the original', async () => {
      const v = await post(receipt({ sourceType: 'patient_payment', sourceId: uuid(6) }));
      const r = await ds.transaction((m) => service.reverse(m, { organisationId: ORG_A, voucherId: v!.id, reason: 'entered twice', createdBy: USER }));
      const [row] = await ds.query(`SELECT reversal_of, reversal_reason, source_type FROM vouchers WHERE id=$1`, [r.id]);
      expect(row).toEqual({ reversal_of: v!.id, reversal_reason: 'entered twice', source_type: 'reversal' });
      const lines = await ds.query(`SELECT account_id, debit, credit FROM voucher_lines WHERE voucher_id=$1 ORDER BY line_no`, [r.id]);
      expect(lines).toEqual([
        { account_id: CASH_A, debit: '0.00', credit: '500.00' },
        { account_id: INCOME_A, debit: '500.00', credit: '0.00' },
      ]);

      await expect(ds.transaction((m) => service.reverse(m, { organisationId: ORG_A, voucherId: v!.id, reason: 'again', createdBy: USER })))
        .rejects.toThrow('already been reversed');
      await expect(ds.transaction((m) => service.reverse(m, { organisationId: ORG_A, voucherId: r.id, reason: 'undo', createdBy: USER })))
        .rejects.toThrow('cannot itself be reversed');
    });

    it('requires a reason and stays inside the organisation', async () => {
      const v = await post(receipt({ sourceType: 'patient_payment', sourceId: uuid(7) }));
      await expect(ds.transaction((m) => service.reverse(m, { organisationId: ORG_A, voucherId: v!.id, reason: '  ', createdBy: USER })))
        .rejects.toThrow(BadRequestException);
      await expect(ds.transaction((m) => service.reverse(m, { organisationId: ORG_B, voucherId: v!.id, reason: 'x', createdBy: USER })))
        .rejects.toThrow('Voucher not found');
    });
  });

  describe('day lock', () => {
    let closeId: string;
    beforeAll(async () => {
      [{ id: closeId }] = await ds.query(
        `INSERT INTO day_closes (organisation_id, account_id, close_date, expected_amount, counted_amount, reason, counted_by)
         VALUES ($1,$2,'2026-10-10',1000,950,'short 50',$3) RETURNING id`,
        [ORG_A, CASH_A, USER],
      );
    });

    it.each(['2026-10-10', '2026-10-05'])('rejects posting to %s, on or before the closed day', async (d) => {
      await expect(post(receipt({ voucherDate: d }))).rejects.toThrow('Cash drawer – A Main is closed up to 2026-10-10');
    });

    it('accepts the next day, and a late entry dated today with its original date', async () => {
      await expect(post(receipt({ voucherDate: '2026-10-11' }))).resolves.toBeTruthy();
      await expect(post(receipt({ voucherDate: '2026-10-11', originalDate: '2026-10-09' }))).resolves.toBeTruthy();
    });

    it("accepts the close's own variance voucher on the closed day, and only that one", async () => {
      const variance = (sourceId: string) =>
        post(receipt({ voucherType: 'journal', voucherDate: '2026-10-10', sourceType: 'day_close', sourceId,
          lines: [{ accountId: SHORT_A, debit: 50 }, { accountId: CASH_A, credit: 50 }] }));
      await expect(variance(closeId)).resolves.toMatchObject({ voucherType: 'journal' });
      await expect(variance(uuid(8))).rejects.toThrow('is closed up to');
    });

    it('still rejects at the database if a caller bypasses the service', async () => {
      await expect(ds.transaction(async (m) => {
        const [{ id }] = await m.query(
          `INSERT INTO vouchers (organisation_id, voucher_type, voucher_number, voucher_date, narration, source_type, created_by)
           VALUES ($1,'receipt',9999,'2026-10-10','bypass','money_in',$2) RETURNING id`, [ORG_A, USER]);
        await m.query(`INSERT INTO voucher_lines (voucher_id, organisation_id, line_no, account_id, debit, credit)
                       VALUES ($1,$2,1,$3,5,0),($1,$2,2,$4,0,5)`, [id, ORG_A, CASH_A, INCOME_A]);
      })).rejects.toThrow('is closed for this account');
    });
  });

  describe('module switch', () => {
    const offLines = [{ accountId: CASH_OFF, debit: 5 }, { accountId: INCOME_OFF, credit: 5 }];

    it('skips source-driven posts while the module is off, and writes nothing', async () => {
      await expect(post(receipt({ organisationId: ORG_OFF, lines: offLines, sourceType: 'patient_payment', sourceId: uuid(9) }))).resolves.toBeNull();
      expect(await count(`SELECT count(*) FROM vouchers WHERE organisation_id=$1`, [ORG_OFF])).toBe(0);
    });

    it('refuses manual entries while the module is off', async () => {
      await expect(post(receipt({ organisationId: ORG_OFF, lines: offLines, requireLive: true })))
        .rejects.toThrow('Cash tracking is not switched on');
    });

    it('skips source-driven posts dated before go-live, and refuses manual ones', async () => {
      await expect(post(receipt({ voucherDate: '2026-08-31', sourceType: 'patient_payment', sourceId: uuid(10) }))).resolves.toBeNull();
      await expect(post(receipt({ voucherDate: '2026-08-31', requireLive: true }))).rejects.toThrow('Cash tracking starts on 2026-09-01');
    });
  });

  it('keeps posted rows immutable at the database', async () => {
    // Dated after the day-lock block's close (2026-10-10).
    const v = await post(receipt({ voucherDate: '2026-10-20', sourceType: 'patient_payment', sourceId: uuid(11) }));
    await expect(ds.query(`UPDATE voucher_lines SET debit = 5000 WHERE voucher_id = $1`, [v!.id])).rejects.toThrow('immutable');
    await expect(ds.query(`DELETE FROM vouchers WHERE id = $1`, [v!.id])).rejects.toThrow('immutable');
  });
});
