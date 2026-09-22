/**
 * Fail-closed field policy for `changes` diffs (see
 * scope/Audit_Trail_Accountability_Scope_v4.md "Field policy"). Each
 * auditable entity declares which fields are ALLOWED into `changes`;
 * anything not listed is dropped, not captured by default. This fails
 * closed on purpose: a new column added to an entity later is NOT
 * captured until someone explicitly adds it here.
 *
 * `neverInclude` is defense-in-depth for known secrets, checked even if
 * an allowlist is ever misconfigured to include them.
 *
 * Phase 1 (Auth) doesn't generically diff any entity -- every Auth event
 * is an explicit security event, not a row diff -- so this map has no
 * entries yet. Phase 3 (Patients) populates it from real entity columns,
 * the same way this file's shape was decided: grep the actual entity,
 * don't guess.
 */
export const AUDIT_FIELD_POLICY: Record<
  string,
  { allowed: string[]; neverInclude?: string[] }
> = {};

/**
 * Filters a raw before/after diff down to the entity's allowlist. An
 * entity with no policy entry returns null (logged by the caller as a
 * warning) rather than defaulting to capturing every field.
 */
export function filterAuditChanges(
  entityType: string,
  rawChanges: Record<string, { from: unknown; to: unknown }>,
): Record<string, { from: unknown; to: unknown }> | null {
  const policy = AUDIT_FIELD_POLICY[entityType];
  if (!policy) return null;

  const neverInclude = new Set(policy.neverInclude ?? []);
  const allowed = new Set(policy.allowed);

  const filtered: Record<string, { from: unknown; to: unknown }> = {};
  for (const [field, value] of Object.entries(rawChanges)) {
    if (neverInclude.has(field)) continue;
    if (!allowed.has(field)) continue;
    filtered[field] = value;
  }
  return filtered;
}
