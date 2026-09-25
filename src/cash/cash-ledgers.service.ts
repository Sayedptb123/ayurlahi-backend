import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

// Ledgers the patient-payment flow and go-live need (Cash MVP plan §4), seeded per
// organisation and found by system_key, never by name. Seeding is separate from
// posting and does not switch anything on: cash_module_live_from stays the gate.

export const INCOME_LEDGERS: Array<{ key: string; name: string }> = [
  { key: 'income_consultation', name: 'Consultation' },
  { key: 'income_room_stay', name: 'Room & stay' },
  { key: 'income_treatment', name: 'Treatment & procedures' },
  { key: 'income_pharmacy', name: 'Pharmacy & medicines' },
  { key: 'income_lab', name: 'Lab tests' },
  { key: 'income_other', name: 'Other patient income' },
];

export const EXPENSE_LEDGERS: Array<{ key: string; name: string }> = [
  { key: 'expense_operations', name: 'Operations' },
  { key: 'expense_salary', name: 'Salary' },
  { key: 'expense_inventory', name: 'Medicines & supplies' },
  { key: 'expense_marketing', name: 'Marketing' },
  { key: 'expense_maintenance', name: 'Maintenance' },
  { key: 'expense_utilities', name: 'Utilities' },
  { key: 'expense_other', name: 'Other expenses' },
];

// expenses.category (lower-cased) → expense ledger; anything else → Other.
export function expenseLedgerKey(category: string | null | undefined): string {
  const k = `expense_${String(category ?? '').trim().toLowerCase()}`;
  return EXPENSE_LEDGERS.some((l) => l.key === k) ? k : 'expense_other';
}

// bill_items.item_type → income ledger.
export const INCOME_KEY_BY_ITEM_TYPE: Record<string, string> = {
  consultation: 'income_consultation',
  accommodation: 'income_room_stay',
  procedure: 'income_treatment',
  medicine: 'income_pharmacy',
  'lab-test': 'income_lab',
  other: 'income_other',
};

// Which ledger kinds can receive money paid by each patient payment method.
// held_by_partner: a partner collected it (plan §4b).
const RECEIVING_KINDS: Record<string, string[]> = {
  cash: ['cash', 'held_by_partner'],
  upi: ['upi', 'held_by_partner'],
  card: ['bank'],
  online: ['bank', 'upi'],
  cheque: ['bank'],
  bank_transfer: ['bank'],
  // A hospital cost paid from the hospital's own money (Batch 3 adds staff/partner-paid).
  hospital: ['cash', 'bank', 'upi'],
};

export interface IncomeShare {
  accountId: string;
  paise: number;
}

@Injectable()
export class CashLedgersService {
  // Ledger kinds that can receive a payment made by this method.
  static receivingKinds(paymentMethod: string): string[] {
    return RECEIVING_KINDS[paymentMethod] ?? [];
  }

  // Idempotent: creates only what's missing. A branch gets its own cash drawer;
  // an organisation with no branches gets one organisation-wide drawer.
  async seedPaymentLedgers(manager: EntityManager, organisationId: string): Promise<number> {
    const branches: Array<{ id: string; name: string }> = await manager.query(
      `SELECT id, name FROM branches WHERE organisation_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [organisationId],
    );
    const rows: Array<[string | null, string, string, string]> = [
      ...(branches.length
        ? branches.map((b): [string | null, string, string, string] => [b.id, 'cash', `Cash drawer – ${b.name}`, `cash_drawer:${b.id}`])
        : [[null, 'cash', 'Cash drawer', 'cash_drawer'] as [string | null, string, string, string]]),
      [null, 'bank', 'Bank', 'bank'],
      [null, 'upi', 'UPI', 'upi'],
      ...INCOME_LEDGERS.map((l): [string | null, string, string, string] => [null, 'income', l.name, l.key]),
      ...EXPENSE_LEDGERS.map((l): [string | null, string, string, string] => [null, 'expense', l.name, l.key]),
      // Needed by go-live's opening journal (review §7).
      [null, 'patient_advances', 'Patient advances', 'patient_advances'],
      [null, 'opening_balance', 'Opening balance', 'opening_balance'],
    ];
    let created = 0;
    for (const [branchId, kind, name, key] of rows) {
      const res = await manager.query(
        `INSERT INTO accounts (organisation_id, branch_id, kind, name, system_key)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [organisationId, branchId, kind, name, key],
      );
      created += res.length;
    }
    return created;
  }

  // The ledger a patient payment was received into: must belong to the
  // organisation, be active, and suit the payment method.
  // recordBranchId: the branch of the bill / booking / cost being paid
  // (branch scoping G7). A branch's own ledger (its cash drawer) can only take
  // money for that branch's records; organisation-wide ledgers (bank, UPI,
  // partners — branch_id NULL) serve every branch. Required, so every caller
  // has to say which record the money belongs to.
  async checkReceivingAccount(
    manager: EntityManager,
    organisationId: string,
    accountId: string,
    paymentMethod: string,
    recordBranchId: string | null,
  ): Promise<void> {
    const [a] = await manager.query(
      `SELECT a.kind, a.name, a.is_active, a.branch_id,
              (a.partner_id IS NULL OR EXISTS (SELECT 1 FROM partners p
                 WHERE p.id = a.partner_id AND p.is_active AND p.deleted_at IS NULL)) AS partner_ok
         FROM accounts a WHERE a.id = $1 AND a.organisation_id = $2`,
      [accountId, organisationId],
    );
    if (!a) throw new NotFoundException('Ledger not found in this organisation');
    if (!a.is_active) throw new BadRequestException(`Ledger "${a.name}" is inactive`);
    // A switched-off partner takes no new collections (Set-up §4b).
    if (!a.partner_ok) throw new BadRequestException(`"${a.name}" belongs to a partner who is switched off`);
    if (a.branch_id && recordBranchId && a.branch_id !== recordBranchId) {
      throw new BadRequestException(`"${a.name}" belongs to another branch`);
    }
    const allowed = CashLedgersService.receivingKinds(paymentMethod);
    if (!allowed.includes(a.kind)) {
      throw new BadRequestException(`A ${paymentMethod} payment can't be received into "${a.name}"`);
    }
  }

  // Splits a payment across income ledgers in proportion to the bill's item
  // totals, in paise; any remainder goes to the largest share so the parts
  // always add up to the payment exactly.
  async incomeShares(
    manager: EntityManager,
    organisationId: string,
    billId: string,
    paise: number,
  ): Promise<IncomeShare[]> {
    // bill_items columns are camelCase in the database ("itemType", "billId").
    const items: Array<{ item_type: string; total: string }> = await manager.query(
      `SELECT "itemType" AS item_type, total FROM bill_items WHERE "billId" = $1`,
      [billId],
    );
    const weights = new Map<string, number>();
    for (const i of items) {
      const key = INCOME_KEY_BY_ITEM_TYPE[i.item_type] ?? 'income_other';
      const w = Math.max(0, Math.round(parseFloat(i.total) * 100));
      weights.set(key, (weights.get(key) ?? 0) + w);
    }
    const totalWeight = [...weights.values()].reduce((s, w) => s + w, 0);
    const keys = totalWeight > 0 ? [...weights.keys()].filter((k) => weights.get(k)! > 0) : ['income_other'];

    const ledgers: Array<{ id: string; system_key: string }> = await manager.query(
      `SELECT id, system_key FROM accounts WHERE organisation_id = $1 AND system_key = ANY($2::text[]) AND is_active`,
      [organisationId, keys],
    );
    const idFor = (k: string) => {
      const l = ledgers.find((x) => x.system_key === k);
      if (!l) throw new BadRequestException('Cash ledgers are not set up for this organisation');
      return l.id;
    };
    if (totalWeight === 0) return [{ accountId: idFor('income_other'), paise }];

    const shares = keys.map((k) => ({ key: k, paise: Math.floor((paise * weights.get(k)!) / totalWeight) }));
    const rest = paise - shares.reduce((s, x) => s + x.paise, 0);
    shares.sort((a, b) => weights.get(b.key)! - weights.get(a.key)!)[0].paise += rest;
    return shares.filter((s) => s.paise > 0).map((s) => ({ accountId: idFor(s.key), paise: s.paise }));
  }
}
