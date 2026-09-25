import { EntityManager } from 'typeorm';

// The one definition of a ledger balance (Cash Set-up plan §4a): Σ(debit − credit)
// over voucher_lines, in paise. Never stored (plan D9). Reversals need no special
// case (their lines are the original's, swapped), and a zero check doesn't depend
// on the ledger's normal side. Used by Cash Today, Cash Book and Cash Set-up so
// they can never disagree about a balance.
//
// Date bounds are business dates on the voucher: `before` = strictly earlier
// (an opening balance), `upTo` = on or before (a closing balance). Neither = all time.
export async function ledgerBalances(
  manager: EntityManager,
  organisationId: string,
  accountIds: string[],
  bounds: { before?: string; upTo?: string } = {},
): Promise<Map<string, number>> {
  const out = new Map<string, number>(accountIds.map((id) => [id, 0]));
  if (!accountIds.length) return out;
  const rows: Array<{ account_id: string; p: string }> = await manager.query(
    `SELECT l.account_id, round(sum(l.debit - l.credit) * 100)::bigint AS p
       FROM voucher_lines l
       JOIN vouchers v ON v.id = l.voucher_id AND v.organisation_id = l.organisation_id
      WHERE l.organisation_id = $1 AND l.account_id = ANY($2::uuid[])
        AND ($3::date IS NULL OR v.voucher_date < $3::date)
        AND ($4::date IS NULL OR v.voucher_date <= $4::date)
      GROUP BY l.account_id`,
    [organisationId, accountIds, bounds.before ?? null, bounds.upTo ?? null],
  );
  for (const r of rows) out.set(r.account_id, Number(r.p));
  return out;
}

// Which accounts have any voucher line at all (their branch can no longer change).
export async function accountsWithLines(
  manager: EntityManager,
  organisationId: string,
  accountIds: string[],
): Promise<Set<string>> {
  if (!accountIds.length) return new Set();
  const rows: Array<{ account_id: string }> = await manager.query(
    `SELECT DISTINCT account_id FROM voucher_lines WHERE organisation_id = $1 AND account_id = ANY($2::uuid[])`,
    [organisationId, accountIds],
  );
  return new Set(rows.map((r) => r.account_id));
}
