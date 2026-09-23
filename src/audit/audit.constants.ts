/**
 * Maximum allowed span between createdAfter/createdBefore on any audit-log
 * list query, in days. See "Boundary semantics" in
 * scope/Audit_Trail_ReadAPI_AdminUI_Implementation_Plan.md -- enforced
 * server-side only; the frontend's own copy of this number is UX
 * convenience, never the authority.
 */
export const AUDIT_MAX_QUERY_WINDOW_DAYS = 90;
