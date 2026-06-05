# Sales CRM module

Expands the "Ayurvedic Center" drawer into a Sales CRM for the marketing team
(telecallers + field staff) to discover, contact, visit, track, and onboard
Ayurvedic / postnatal centres as Medilink customers.

> Full brief: `scope/Medilink_CRM_Final_Brief.md`.

## Ownership / multi-tenancy

The CRM belongs to the **AYURLAHI_TEAM** organisation. Every table carries
`organisation_id -> organisations(id)` like the rest of the schema. "Leads" are
**prospect** centres (not tenant data); when a lead is Onboarded (WON) it links
to the newly-created CLINIC org via `crm_leads.onboarded_organisation_id`.

Non-team users (clinic/manufacturer) are denied at the guard — gated on
`organisationType === 'AYURLAHI_TEAM'`, never on role name (OWNER/ADMIN are
generic roles other org types also use).

## Data model

| Table | Purpose |
|---|---|
| `crm_pipeline_stages` | Configurable stages (B2). Seeded with the 10 default stages. |
| `crm_leads` | Prospect centre + assignment + pipeline stage + priority. Dedupe via `google_place_id`; `is_incomplete` / `duplicate_of_lead_id` flags. |
| `crm_activities` | Interaction timeline (call/whatsapp/visit/email/note). `occurred_at` is the real touch time; `call_log_verified`, `created_offline`/`synced_at` for anti-fraud + offline. |
| `crm_requirements` | Structured requirement / feedback capture. |
| `crm_tasks` | Follow-ups, reminders, escalation. |
| `crm_visits` | Geo check-in/out, distance-from-registered, photos, offline. |
| `crm_audit_log` | Append-only trail (never updated/deleted). |

Numeric columns (lat/lng/rating/distance) return **strings** from PostgreSQL —
`parseFloat()` before arithmetic (hard rule #5).

## Role matrix (B1) — enforced server-side

| Role | Sees | Can do |
|---|---|---|
| `TELECALLER` | only own assigned leads | log calls/notes, follow-ups, advance stage up to **demo_scheduled**, set On Hold |
| `FIELD_STAFF` | only own assigned leads | + visits/check-in, advance up to **negotiation** |
| `TEAM_LEAD` | own assigned leads (team scoping deferred — TRACKER T8) | + reassign leads they hold |
| `SALES_MANAGER` | all leads | assign/reassign, override stages, mark **Won/Lost**, reports, export |
| `OWNER` / `ADMIN` / `SUPER_ADMIN` | everything | + configure stages, view audit log |

Enforcement layers:
- **`OrganisationGuard`** — pins every request to the caller's own org.
- **`CrmRolesGuard`** (`src/crm/guards`) — gates the module to AYURLAHI_TEAM and
  checks the **raw** JWT role against `@CrmRoles(...)`. (The platform
  `RolesGuard` collapses all team members to ADMIN, so it can't be used here.)
- **Service-layer row isolation** — `CrmLeadsService` filters every read/write
  by assignment for non-manager roles; `findOne` on an unassigned lead returns
  404 (no existence leak).

## Endpoints

Leads & pipeline (Step 3b):
```
GET    /organisations/:orgId/crm/leads            list (scoped, filters, pagination)
GET    /organisations/:orgId/crm/leads/:id        single (isolation enforced)
POST   /organisations/:orgId/crm/leads            create (dedupe warn; managers may assign)
PATCH  /organisations/:orgId/crm/leads/:id        update profile fields
POST   /organisations/:orgId/crm/leads/:id/assign assign/reassign  [SALES_MANAGER, TEAM_LEAD]
POST   /organisations/:orgId/crm/leads/:id/stage  change stage (role-capped; Lost needs reason)
DELETE /organisations/:orgId/crm/leads/:id        soft delete  [SALES_MANAGER]
GET    /organisations/:orgId/crm/leads/:id/audit  audit trail  [SALES_MANAGER]
GET    /organisations/:orgId/crm/stages           list stages
POST   /organisations/:orgId/crm/stages           create stage  [OWNER, ADMIN]
PATCH  /organisations/:orgId/crm/stages/:id       update stage  [OWNER, ADMIN]
```

Activities, requirements, tasks, visits (Step 3c):
```
GET    /organisations/:orgId/crm/leads/:leadId/activities      timeline
POST   /organisations/:orgId/crm/leads/:leadId/activities      log touch (call needs disposition; future next-action auto-creates a task)
GET    /organisations/:orgId/crm/leads/:leadId/requirements    list
POST   /organisations/:orgId/crm/leads/:leadId/requirements    capture
PATCH  /organisations/:orgId/crm/leads/:leadId/requirements/:id update
GET    /organisations/:orgId/crm/tasks                         my tasks (?scope=today|overdue|upcoming)
GET    /organisations/:orgId/crm/leads/:leadId/tasks           lead tasks
POST   /organisations/:orgId/crm/leads/:leadId/tasks           create (due must be future)
PATCH  /organisations/:orgId/crm/tasks/:id                     update / set status
POST   /organisations/:orgId/crm/tasks/:id/complete            mark done
GET    /organisations/:orgId/crm/visits                        my visits
GET    /organisations/:orgId/crm/leads/:leadId/visits          lead visits
POST   /organisations/:orgId/crm/leads/:leadId/visits          schedule  [FIELD_STAFF, TEAM_LEAD, SALES_MANAGER]
POST   /organisations/:orgId/crm/visits/:id/check-in           geo check-in (flags >500m)  [FIELD_STAFF, TEAM_LEAD, SALES_MANAGER]
POST   /organisations/:orgId/crm/visits/:id/check-out          check-out  [FIELD_STAFF, TEAM_LEAD, SALES_MANAGER]
```

Filters, facets & staff scopes:
```
GET    /organisations/:orgId/crm/leads?page=&state=&district=&centreType=&priority=&stage=&search=&scope=&followUp=
GET    /organisations/:orgId/crm/leads/facets?state=          distinct states + districts (counts), scoped to the caller
GET    /organisations/:orgId/crm/staff                        team members + their scope   [SALES_MANAGER+]
PUT    /organisations/:orgId/crm/staff/:userId/scope          set a member's data scope    [SALES_MANAGER+]
```

## Per-staff data scope (territory)

`crm_staff_scopes` stores, per user, allowed `states` / `districts` / `stages` /
`centre_types` / `priorities` (jsonb arrays). Semantics: **OR within a
dimension, AND across dimensions**; empty/absent array = no restriction there.
Enforced in `findAll`, `findOne`, and `facets` **on top of** role isolation.
`SUPER_ADMIN` is exempt (always full view). Owners/managers set scopes via the
CRM Staff screen / `PUT .../staff/:userId/scope`.

## Migrations & seed

- `src/migrations/2026-06-04-crm-sales-module.sql` — 7 tables + seeds default stages + RLS.
- `src/migrations/2026-06-04-crm-sales-roles.sql` — extends `organisation_users.role` CHECK.
- `scripts/seed-crm-leads.js` — imports scraped centres into `crm_leads` (idempotent).

## Not yet built (later steps)

The B6 notification matrix; reports + export (Manager/Owner only); native
call-log verification + offline sync queue; mobile UI. The `crm_activities` /
`crm_visits` tables already carry the `call_log_verified`, `created_offline`,
and `synced_at` columns the offline + anti-fraud work will use. See the brief's
Part C status table.
