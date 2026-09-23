import { BadRequestException } from '@nestjs/common';
import { PatientBillingService } from './patient-billing.service';
import { PatientBill, BillStatus, PaymentMethod } from './entities/patient-bill.entity';
import { PatientBillPayment } from './entities/patient-bill-payment.entity';

// G1 + G2 from scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md §2:
// money taken while creating a bill must land in the payment ledger, and a bill
// edit must never set paid_amount or a payment-derived status.

const item = { itemType: 'consultation', itemName: 'Consultation', quantity: 1, unitPrice: 1000 };

const makeService = (opts: { ledgerSum?: number; bill?: any } = {}) => {
  const managerSave = jest.fn((_entity: any, x: any) =>
    Promise.resolve(x.id ? x : { ...x, id: 'bill-1' }),
  );
  const manager: any = {
    save: managerSave,
    create: jest.fn((_entity: any, x: any) => x),
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
  const none: any = { findOne: jest.fn(() => Promise.resolve(null)) };

  const service = new PatientBillingService(
    billsRepository,
    billItemsRepository,
    billPaymentsRepository,
    none, none, none, none, none, none,
    { sendToUsers: jest.fn() } as any,
    { resolveVisibleBranchIds: jest.fn() } as any,
  );
  return { service, billsRepository, billItemsRepository, managerSave };
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
