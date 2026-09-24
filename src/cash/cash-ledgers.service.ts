import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

// Ledgers the patient-payment flow needs (Cash MVP plan §4), seeded per
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
};

export interface IncomeShare {
  accountId: string;
  paise: number;
}

@Injectable()
export class CashLedgersService {
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
  async checkReceivingAccount(
    manager: EntityManager,
    organisationId: string,
    accountId: string,
    paymentMethod: string,
  ): Promise<void> {
    const [a] = await manager.query(
      `SELECT kind, name, is_active FROM accounts WHERE id = $1 AND organisation_id = $2`,
      [accountId, organisationId],
    );
    if (!a) throw new NotFoundException('Ledger not found in this organisation');
    if (!a.is_active) throw new BadRequestException(`Ledger "${a.name}" is inactive`);
    const allowed = RECEIVING_KINDS[paymentMethod] ?? [];
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
