import { BadRequestException } from '@nestjs/common';
import { PatientBillingService } from './patient-billing.service';
import { PatientBill, BillStatus, PaymentMethod } from './entities/patient-bill.entity';
import { PatientBillPayment } from './entities/patient-bill-payment.entity';

// G1 + G2 from scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md §2:
// money taken while creating a bill must land in the payment ledger, and a bill
// edit must never set paid_amount or a payment-derived status.

const item = { itemType: 'consultation', itemName: 'Consultation', quantity: 1, unitPrice: 1000 };

const makeService = (
  opts: { ledgerSum?: number; bill?: any; maxBillNumber?: number | null; saveError?: any } = {},
) => {
  const managerSave = jest.fn((_entity: any, x: any) =>
    Promise.resolve(x.id ? x : { ...x, id: 'bill-1' }),
  );
  if (opts.saveError) managerSave.mockImplementationOnce(() => Promise.reject(opts.saveError));
  const managerQuery = jest.fn((sql: string) =>
    Promise.resolve(
      sql.includes('pg_advisory_xact_lock')
        ? [{}]
        : sql.includes('timezone')
          ? [{ timezone: 'Asia/Kolkata' }]
          : [{ max: opts.maxBillNumber ?? 0 }],
    ),
  );
  const manager: any = {
    save: managerSave,
    create: jest.fn((_entity: any, x: any) => x),
    query: managerQuery,
  };
  const billsRepository: any = {
    count: jest.fn(() => Promise.resolve(0)),
    findOne: jest.fn(() => Promise.resolve(opts.bill ?? null)),
    create: jest.fn((x: any) => x),
    save: jest.fn((x: any) => Promise.resolve(x)),
    manager: { transaction: jest.fn((cb: any) => cb(manager)) },
  };
  const billItemsRepository: any = {
    create: jest.fn((x: any) => x),
    delete: jest.fn(() => Promise.resolve()),
  };
  const billPaymentsRepository: any = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(() => Promise.resolve({ sum: String(opts.ledgerSum ?? 0) })),
    })),
  };
  const paymentPosting = {
    checkReceivingAccount: jest.fn(() => Promise.resolve()),
    post: jest.fn(() => Promise.resolve(null)),
    reverse: jest.fn(() => Promise.resolve(null)),
  };
  const none: any = { findOne: jest.fn(() => Promise.resolve(null)), find: jest.fn(() => Promise.resolve([])) };

  const service = new PatientBillingService(
    billsRepository,
    billItemsRepository,
    billPaymentsRepository,
    none, none, none, none, none, none,
    { sendToUsers: jest.fn() } as any,
    { resolveVisibleBranchIds: jest.fn() } as any,
    paymentPosting as any,
  );
  return { service, billsRepository, billItemsRepository, managerSave, managerQuery, manager, paymentPosting };
};

const createBill = (service: PatientBillingService, dto: any) =>
  service.create('u-1', 'RECEPTIONIST', 'org-1', 'CLINIC', {
    walkInName: 'Walk-in',
    billDate: '2026-09-24',
    items: [item],
    ...dto,
  });

const paymentSaves = (managerSave: jest.Mock) =>
  managerSave.mock.calls.filter(([entity]) => entity === PatientBillPayment).map(([, x]) => x);

describe('PatientBillingService.create — paid amount goes into the ledger (G1)', () => {
  it('writes one ledger row for the amount paid at billing, in the same transaction as the bill', async () => {
    const { service, billsRepository, managerSave } = makeService();
    const bill = await createBill(service, { paidAmount: 400, paymentMethod: PaymentMethod.UPI });

    expect(billsRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(managerSave.mock.calls[0][0]).toBe(PatientBill);
    expect(paymentSaves(managerSave)).toEqual([
      expect.objectContaining({
        organisationId: 'org-1',
        billId: 'bill-1',
        amount: 400,
        paidAt: '2026-09-24',
        paymentMethod: PaymentMethod.UPI,
        createdBy: 'u-1',
      }),
    ]);
    expect(bill.paidAmount).toBe(400);
    expect(bill.status).toBe(BillStatus.PARTIAL);
  });

  it('marks a fully paid bill PAID and still writes the ledger row', async () => {
    const { service, managerSave } = makeService();
    const bill = await createBill(service, { paidAmount: 1000, paymentMethod: PaymentMethod.CASH });
    expect(bill.status).toBe(BillStatus.PAID);
    expect(paymentSaves(managerSave)).toHaveLength(1);
  });

  it('writes no ledger row when nothing was paid', async () => {
    const { service, managerSave } = makeService();
    const bill = await createBill(service, { paymentMethod: PaymentMethod.CASH });
    expect(paymentSaves(managerSave)).toHaveLength(0);
    expect(bill.status).toBe(BillStatus.PENDING);
  });

  it('rejects overpayment', async () => {
    const { service, managerSave } = makeService();
    await expect(
      createBill(service, { paidAmount: 1000.5, paymentMethod: PaymentMethod.CASH }),
    ).rejects.toThrow(BadRequestException);
    expect(managerSave).not.toHaveBeenCalled();
  });

  it('requires a payment method when an amount is paid', async () => {
    const { service } = makeService();
    await expect(createBill(service, { paidAmount: 200 })).rejects.toThrow(
      'paymentMethod is required when paidAmount is set',
    );
  });

  it('rejects a payment on a bill created as cancelled', async () => {
    const { service } = makeService();
    await expect(
      createBill(service, {
        paidAmount: 200,
        paymentMethod: PaymentMethod.CASH,
        status: BillStatus.CANCELLED,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('PatientBillingService.update — ledger owns paid amount and status (G2)', () => {
  const existing = (over: any = {}) => ({
    id: 'bill-1',
    organisationId: 'org-1',
    billNumber: 'BILL-00001',
    subtotal: 1000,
    discount: 0,
    tax: 0,
    total: 1000,
    paidAmount: 400,
    status: BillStatus.PARTIAL,
    items: [{ ...item, discount: 0 }],
    ...over,
  });
  const update = (service: PatientBillingService, dto: any) =>
    service.update('bill-1', 'u-1', 'MANAGER', 'org-1', 'CLINIC', dto);

  it.each([BillStatus.PAID, BillStatus.PARTIAL])('rejects setting status %s directly', async (status) => {
    const { service, billsRepository } = makeService({ bill: existing() });
    await expect(update(service, { status })).rejects.toThrow(BadRequestException);
    expect(billsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects moving a bill with payments back to pending', async () => {
    const { service, billsRepository } = makeService({ bill: existing(), ledgerSum: 400 });
    await expect(update(service, { status: BillStatus.PENDING })).rejects.toThrow(
      'This bill has recorded payments, so its status follows them',
    );
    expect(billsRepository.save).not.toHaveBeenCalled();
  });

  it('still allows cancelling a bill with payments', async () => {
    const { service } = makeService({ bill: existing(), ledgerSum: 400 });
    const saved = await update(service, { status: BillStatus.CANCELLED });
    expect(saved.status).toBe(BillStatus.CANCELLED);
  });

  it('allows draft → pending when nothing is paid', async () => {
    const { service } = makeService({
      bill: existing({ status: BillStatus.DRAFT, paidAmount: 0 }),
      ledgerSum: 0,
    });
    const saved = await update(service, { status: BillStatus.PENDING });
    expect(saved.status).toBe(BillStatus.PENDING);
  });

  it('rejects a total below the amount already paid, before touching the items', async () => {
    const { service, billItemsRepository, billsRepository } = makeService({
      bill: existing(),
      ledgerSum: 400,
    });
    await expect(
      update(service, { items: [{ ...item, unitPrice: 300 }] }),
    ).rejects.toThrow('Bill total cannot be less than the amount already paid');
    expect(billItemsRepository.delete).not.toHaveBeenCalled();
    expect(billsRepository.save).not.toHaveBeenCalled();
  });

  it('re-derives PAID when a discount brings the total down to the amount paid', async () => {
    const { service } = makeService({ bill: existing(), ledgerSum: 400 });
    const saved = await update(service, { discount: 600 });
    expect(saved.status).toBe(BillStatus.PAID);
  });

  it('re-derives PARTIAL when a paid bill gains an item', async () => {
    const { service } = makeService({
      bill: existing({ paidAmount: 1000, status: BillStatus.PAID }),
      ledgerSum: 1000,
    });
    const saved = await update(service, {
      items: [item, { ...item, itemName: 'Oil', unitPrice: 250 }],
    });
    expect(saved.status).toBe(BillStatus.PARTIAL);
  });

  it('does not write paid_amount from the request', async () => {
    const { service } = makeService({ bill: existing(), ledgerSum: 400 });
    const saved = await update(service, { notes: 'x', paidAmount: 9999 } as any);
    expect(saved.paidAmount).toBe(400);
  });
});

describe('PatientBillingService — bill numbering survives deleted bills', () => {
  it('takes the highest issued number + 1, not the live-bill count', async () => {
    // CNS on staging: live 00001, 00002, 00003, 00005 (00004 deleted) → count+1 collided with 00005.
    const { service, managerSave } = makeService({ maxBillNumber: 5 });
    await createBill(service, {});
    expect(managerSave.mock.calls[0][1].billNumber).toBe('BILL-00006');
  });

  it('starts at BILL-00001 for an org with no bills', async () => {
    const { service, managerSave } = makeService({ maxBillNumber: null });
    await createBill(service, {});
    expect(managerSave.mock.calls[0][1].billNumber).toBe('BILL-00001');
  });

  it('counts soft-deleted bills and ignores non-standard numbers when finding the highest', async () => {
    const { service, managerQuery } = makeService({ maxBillNumber: 4 });
    await createBill(service, {});
    const maxSql: string = managerQuery.mock.calls.find(([sql]) => sql.includes('MAX'))[0];
    expect(maxSql).not.toMatch(/deleted_at/);
    expect(maxSql).toContain("'^BILL-([0-9]+)$'");
  });

  it('takes the per-org lock before reading the highest number, inside the save transaction', async () => {
    const { service, managerQuery, billsRepository } = makeService({ maxBillNumber: 1 });
    await createBill(service, {});
    expect(billsRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(managerQuery.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(managerQuery.mock.calls[0][1]).toEqual(['patient_bill_number:org-1']);
    expect(managerQuery.mock.calls[1][0]).toContain('MAX');
  });

  it('keeps a supplied bill number and allocates nothing', async () => {
    const { service, managerSave, managerQuery } = makeService();
    await createBill(service, { billNumber: 'OP-77' });
    expect(managerSave.mock.calls[0][1].billNumber).toBe('OP-77');
    expect(managerQuery).not.toHaveBeenCalled();
  });

  it('turns a duplicate-number race on insert into a 409, not a 500', async () => {
    const { service } = makeService({
      saveError: Object.assign(new Error('duplicate'), { code: '23505', constraint: 'idx_bills_org_number' }),
    });
    await expect(createBill(service, { billNumber: 'OP-77' })).rejects.toThrow(
      'Bill number OP-77 already exists',
    );
  });

  it('uses the same allocation when admission builds a bill', async () => {
    const { service, manager } = makeService({ maxBillNumber: 9 });
    const bill = await service.buildBillFromBooking(manager, {
      organisationId: 'org-1',
      patientId: 'p-1',
      bookingId: null,
      admissionId: 'adm-1',
      lineItems: [{ name: 'Room', unitPrice: 500 }],
      advancePaid: 0,
    });
    expect(bill.billNumber).toBe('BILL-00010');
  });
});

describe('PatientBillingService — "today" is the organisation business date (G9)', () => {
  afterEach(() => jest.useRealTimers());

  // 01:28 IST on 24 Sep = 19:58Z on 23 Sep: the UTC date is still the 23rd.
  const lateNight = new Date('2026-09-23T19:58:00Z');

  it('admission bill and its advance are dated the IST day, not the UTC day', async () => {
    jest.useFakeTimers({ now: lateNight, doNotFake: ['nextTick', 'setImmediate'] });
    const { service, manager, managerSave } = makeService({ maxBillNumber: 1 });
    const bill = await service.buildBillFromBooking(manager, {
      organisationId: 'org-1',
      patientId: 'p-1',
      bookingId: 'b-1',
      admissionId: 'adm-1',
      lineItems: [{ name: 'Room', unitPrice: 500 }],
      advancePaid: 200,
    });
    expect(bill.billDate as unknown as string).toBe('2026-09-24');
    expect(paymentSaves(managerSave)[0].paidAt).toBe('2026-09-24');
  });

  it('recordPayment defaults paidAt to the IST day, and keeps a supplied date', async () => {
    jest.useFakeTimers({ now: lateNight, doNotFake: ['nextTick', 'setImmediate'] });
    const payRepoSave = jest.fn((x: any) => Promise.resolve(x));
    const bill = { id: 'bill-1', organisationId: 'org-1', total: 1000, status: BillStatus.PENDING };
    const { service, manager } = makeService();
    manager.getRepository = jest.fn((entity: any) =>
      entity === PatientBillPayment
        ? {
            create: (x: any) => x,
            save: payRepoSave,
            createQueryBuilder: () => ({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: () => Promise.resolve({ sum: '0' }),
            }),
          }
        : {
            createQueryBuilder: () => ({
              setLock: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getOne: () => Promise.resolve(bill),
            }),
            findOne: () => Promise.resolve({ ...bill }),
            save: (x: any) => Promise.resolve(x),
          },
    );
    jest.spyOn(service, 'findOne').mockResolvedValue(bill as any);

    await service.recordPayment('bill-1', 'u-1', 'RECEPTIONIST', 'org-1', 'CLINIC', {
      amount: 100,
      paymentMethod: PaymentMethod.CASH,
    });
    await service.recordPayment('bill-1', 'u-1', 'RECEPTIONIST', 'org-1', 'CLINIC', {
      amount: 100,
      paymentMethod: PaymentMethod.CASH,
      paidAt: '2026-09-20',
    });
    expect(payRepoSave.mock.calls.map(([x]) => x.paidAt)).toEqual(['2026-09-24', '2026-09-20']);
  });
});

describe('PatientBillingService — Receipt Vouchers for patient payments (cash §5 R1)', () => {
  it('bill created with a paid amount: checks the ledger, saves the payment, then posts it, in one transaction', async () => {
    const { service, managerSave, paymentPosting, billsRepository } = makeService();
    await createBill(service, { paidAmount: 400, paymentMethod: PaymentMethod.CASH, receivedIntoAccountId: 'acc-1' });
    expect(billsRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(paymentPosting.checkReceivingAccount).toHaveBeenCalledWith(expect.anything(), 'org-1', 'acc-1', 'cash');
    const [payment] = paymentSaves(managerSave);
    expect(payment).toMatchObject({ receivedIntoAccountId: 'acc-1', source: 'counter' });
    expect(paymentPosting.post).toHaveBeenCalledTimes(1);
    expect((paymentPosting.post.mock.calls[0] as any[])[1]).toMatchObject({ amount: 400, receivedIntoAccountId: 'acc-1' });
    expect((paymentPosting.post.mock.calls[0] as any[])[3]).toEqual({ userId: 'u-1', role: 'RECEPTIONIST' });
  });

  it('bill created with nothing paid: no payment, no posting', async () => {
    const { service, paymentPosting } = makeService();
    await createBill(service, {});
    expect(paymentPosting.post).not.toHaveBeenCalled();
  });

  it('a posting failure fails the whole bill creation (rolls back with it)', async () => {
    const { service, paymentPosting } = makeService();
    paymentPosting.post.mockRejectedValueOnce(new Error('ledger missing') as never);
    await expect(
      createBill(service, { paidAmount: 400, paymentMethod: PaymentMethod.CASH, receivedIntoAccountId: 'acc-1' }),
    ).rejects.toThrow('ledger missing');
  });

  it('admission advance rows are marked booking_advance (posted by the advance flow later, not as a receipt)', async () => {
    const { service, manager, managerSave } = makeService({ maxBillNumber: 1 });
    await service.buildBillFromBooking(manager, {
      organisationId: 'org-1', patientId: 'p-1', bookingId: 'b-1', admissionId: 'adm-1',
      lineItems: [{ name: 'Room', unitPrice: 500 }], advancePaid: 200,
    });
    expect(paymentSaves(managerSave)[0]).toMatchObject({ source: 'booking_advance' });
  });
});
