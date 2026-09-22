// T26 (2026-09-16, scope/TRACKER.md): the PO status column had no state
// machine at all -- any string was accepted and any transition was legal,
// which is what let a PO be cycled `received -> sent -> received` to credit
// stock twice. Locked-in decision: keep the existing four status names
// (draft/sent/received/cancelled), no `partially_received` state yet
// (Phase 3, if ever). Exported separately from the service so the DTO's
// `@IsIn` validator and the service's transition check share one definition
// rather than drifting apart.
export const PO_STATUSES = ['draft', 'sent', 'received', 'cancelled'] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const PO_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

export function isLegalPoTransition(from: string, to: string): boolean {
  return (PO_TRANSITIONS[from as PoStatus] ?? []).includes(to as PoStatus);
}
