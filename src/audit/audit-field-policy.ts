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
 * is an explicit security event, not a row diff -- so it had no entries.
 * Phase 2 (CRM) adds the first two: only entityType 'lead' and
 * 'requirement' ever produce a real before/after diff (verified against
 * all 14 CRM audit call sites -- see
 * scope/Audit_Trail_Phase2_CRM_Migration_Implementation_Plan.md's "The
 * regression this phase must not introduce"). 'activity'/'task'/'visit'
 * never send a `changes` diff at all (their audit data routes to
 * `metadata` instead via `normalizeCrmChanges()`), so they need no entry
 * here -- Phase 3 (Patients) populates further entries the same way:
 * grep the actual entity/DTO, don't guess.
 *
 * IMPORTANT: keys here must match the literal runtime `entityType`
 * string each caller passes into `AuditService.record()` -- e.g. CRM's
 * CrmAuditEntity value ('lead'), not the TypeScript class name
 * ('CrmLead'). A mismatched key silently drops `changes` to null exactly
 * like having no entry at all, since `filterAuditChanges()` does a plain
 * string lookup with no awareness of class names.
 */
export const AUDIT_FIELD_POLICY: Record<
  string,
  { allowed: string[]; neverInclude?: string[] }
> = {
  // Keyed by the actual runtime `entityType` string CRM passes (the
  // CrmAuditEntity value, e.g. 'lead' -- NOT the TypeScript class name
  // 'CrmLead'). Every field UpdateLeadDto
  // (src/crm/dto/update-lead.dto.ts, itself CreateLeadDto minus
  // assignedTelecallerId/assignedFieldStaffId/force/googlePlaceId, plus
  // lostReason) can carry, plus assignment()'s hardcoded before/after
  // keys (telecaller, field). No exclusions: all of these were already
  // captured unfiltered by the old before/after object, so this
  // preserves that, not narrows it. No secret-shaped field exists on a
  // CRM lead.
  lead: {
    allowed: [
      'name', 'centreType', 'bedCount', 'address', 'area', 'city', 'district',
      'state', 'latitude', 'longitude', 'primaryContactName',
      'primaryContactDesignation', 'phone', 'phoneSecondary', 'whatsapp',
      'email', 'leadSource', 'ownerDoctorName', 'ownerDoctorIsBams',
      'currentSoftware', 'priority', 'tags', 'googleMapsUrl', 'website',
      'lostReason', 'telecaller', 'field',
    ],
  },
  // Every field UpdateRequirementDto (src/crm/dto/requirement.dto.ts) can
  // carry.
  requirement: {
    allowed: [
      'activityId', 'interestLevel', 'modulesWanted', 'painPoints',
      'objections', 'bedCount', 'patientsPerMonth', 'decisionMakerName',
      'spokeToDecisionMaker', 'decisionTimeline', 'competitor',
      'pricingDiscussed', 'pricingReaction', 'verbatimFeedback',
    ],
  },
  // Phase 3 (Patients) -- keyed 'patient' (the literal entityType every
  // PatientsService/RetreatService audit call passes), not 'Patient'.
  // Every field UpdatePatientDto (src/patients/dto/update-patient.dto.ts)
  // can carry, using the entity's own property name where the DTO uses an
  // alias (patientId on the DTO -> patientCode on the entity). No
  // exclusions -- decision D, locked 2026-09-23 after tracing
  // PatientsService.findOne() (patients.service.ts:261-278): AYURLAHI_TEAM
  // already has unrestricted, unaudited, cross-tenant read access to every
  // patient's full clinical record today (both the org-match check and
  // the branch-visibility check are skipped for that org type), and the
  // audit-read gate is the identical condition -- so a full diff here is
  // a strict subset of an exposure surface that already exists, not a new
  // one. See scope/Audit_Trail_Phase3_Patients_Reconnaissance.md.
  patient: {
    allowed: [
      'firstName', 'lastName', 'dateOfBirth', 'gender', 'phone', 'email',
      'address', 'emergencyContact', 'bloodGroup', 'allergies',
      'medicalHistory', 'branchId', 'fileNumber', 'patientCode',
    ],
  },
  // Phase 4 (Prescriptions) -- keyed 'prescription', matching the literal
  // entityType every PrescriptionsService audit call passes. Only the
  // parent scalar fields (UpdatePrescriptionDto minus `items`) -- the
  // items list is deliberately never in `changes` at all (decision B:
  // destroy-and-recreate has no old/new correspondence to diff, so it
  // goes into `metadata` as full before/after snapshots instead), so
  // there's nothing item-level for this allowlist to filter. Decision D
  // locked 2026-09-23: the read gate for this content must mirror
  // PrescriptionsService.findOne()'s actual authorization predicate
  // (organisationType === 'CLINIC' org-match, or SUPER_ADMIN/SUPPORT
  // role for any other org type) whenever a read API is built -- not a
  // static claim that those roles are intrinsically AYURLAHI_TEAM. See
  // scope/Audit_Trail_Phase4_Prescriptions_Reconnaissance.md.
  prescription: {
    allowed: [
      'patientId', 'appointmentId', 'doctorId', 'prescriptionDate',
      'diagnosis', 'notes', 'status',
    ],
  },
};

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
