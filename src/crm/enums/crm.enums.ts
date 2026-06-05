/**
 * Sales CRM shared enums / literal types.
 * See scope/Medilink_CRM_Final_Brief.md.
 */

// B3 Lead/Centre
export type CrmCentreType = 'ayurvedic_clinic' | 'postnatal' | 'hospital_wing';
export type CrmPriority = 'hot' | 'warm' | 'cold';

// B2 default pipeline stage keys (stages are configurable in crm_pipeline_stages,
// so these are the seeded defaults, not an exhaustive enum)
export const CRM_DEFAULT_STAGES = [
  'new',
  'attempted',
  'contacted',
  'interested',
  'demo_scheduled',
  'demo_done',
  'negotiation',
  'onboarded',
  'lost',
  'on_hold',
] as const;

// B3 Activity
export type CrmActivityType = 'call' | 'whatsapp' | 'visit' | 'email' | 'note';

// B4 call dispositions
export const CRM_CALL_DISPOSITIONS = [
  'connected_interested',
  'connected_not_interested',
  'call_back_later',
  'no_answer',
  'busy',
  'switched_off',
  'wrong_number',
  'invalid',
  'language_barrier',
  'refer_to_decision_maker',
] as const;
export type CrmCallDisposition = (typeof CRM_CALL_DISPOSITIONS)[number];

// B3 Task
export type CrmTaskStatus = 'pending' | 'done' | 'overdue' | 'cancelled';

// B3 Requirement
export type CrmInterestLevel = 'high' | 'medium' | 'low';

// B7 audit
export type CrmAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'stage_change'
  | 'assignment'
  | 'export';
export type CrmAuditEntity =
  | 'lead'
  | 'activity'
  | 'requirement'
  | 'task'
  | 'visit'
  | 'assignment'
  | 'stage';
