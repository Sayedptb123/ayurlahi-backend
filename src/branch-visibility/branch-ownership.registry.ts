// Branch ownership registry — scope/Branch_Scoping_Remediation_Plan_2026-09-24.md §7.5, §11.
//
// Every route under a branch-owned area is listed here with the anchor its
// branch comes from and its current status. test/branch-isolation.e2e-spec.ts
// fails when a route under one of these prefixes is missing from this list,
// so a new endpoint cannot ship without someone deciding how it is scoped.
//
// Status:
//   covered   — contract-tested against the final rules (Q1–Q3) and passing
//   reviewed  — correct per code review; contract test lands with its phase
//   gap       — known violation (G-number in the plan); must shrink to zero
//   catalog   — branch-owned setup data (D15), not isolated patient data;
//               role-gating of catalog writes is a separate topic
//   org-wide  — deliberately not branch-scoped (see plan §4)

export type BranchAnchor = 'own' | 'patient' | 'booking' | 'bill' | 'order' | 'none';

export type RouteStatus =
  | { status: 'covered' }
  | { status: 'reviewed'; phase: number }
  | { status: 'gap'; gaps: string[]; phase: number }
  | { status: 'catalog' }
  | { status: 'org-wide'; why: string };

export interface BranchOwnedArea {
  prefix: string; // route path without the global /api prefix
  anchor: BranchAnchor;
  routes: Record<string, RouteStatus>; // key: "METHOD /full/path"
}

const covered: RouteStatus = { status: 'covered' };
const reviewed = (phase: number): RouteStatus => ({ status: 'reviewed', phase });
const gap = (phase: number, ...gaps: string[]): RouteStatus => ({ status: 'gap', gaps, phase });
const catalog: RouteStatus = { status: 'catalog' };
const orgWide = (why: string): RouteStatus => ({ status: 'org-wide', why });

// Q1 (NULL rows) and Q2 (404) change every existing read path, so reads that
// are branch-correct today are 'reviewed' until migrated onto the shared
// helpers in their phase — not 'covered'.
export const BRANCH_OWNED_AREAS: BranchOwnedArea[] = [
  {
    prefix: '/patients',
    anchor: 'own',
    routes: {
      'GET /patients': covered,
      'GET /patients/possible-matches': covered,
      'GET /patients/:id': covered,
      'PATCH /patients/:id': covered,
      'DELETE /patients/:id': covered,
      'POST /patients': covered,
    },
  },
  {
    prefix: '/appointments',
    anchor: 'own',
    routes: {
      'GET /appointments': covered,
      'GET /appointments/:id': covered,
      'PATCH /appointments/:id': covered,
      'DELETE /appointments/:id': covered,
      'POST /appointments': covered,
    },
  },
  {
    prefix: '/patient-billing',
    anchor: 'own',
    routes: {
      'GET /patient-billing': covered,
      'GET /patient-billing/:id': covered,
      'PATCH /patient-billing/:id': covered,
      'DELETE /patient-billing/:id': covered,
      'POST /patient-billing': covered,
      'POST /patient-billing/:id/payment': covered,
      'GET /patient-billing/:id/payments': covered,
      'DELETE /patient-billing/:id/payments/:paymentId': reviewed(3), // same findOne check as payment

    },
  },
  ...(['medical-records', 'prescriptions', 'lab-reports'] as const).map((r) => ({
    prefix: `/${r}`,
    anchor: 'patient' as const,
    routes: {
      [`GET /${r}`]: covered,
      [`GET /${r}/:id`]: covered,
      [`PATCH /${r}/:id`]: covered,
      [`DELETE /${r}/:id`]: covered,
      [`POST /${r}`]: covered,
    },
  })),
  ...(['vitals', 'newborn-assessments'] as const).map((r) => ({
    prefix: `/organisations/:organisationId/${r}`,
    anchor: 'patient' as const,
    routes: {
      [`GET /organisations/:organisationId/${r}`]: covered,
      [`POST /organisations/:organisationId/${r}`]: covered,
      [`DELETE /organisations/:organisationId/${r}/:id`]: covered,
    },
  })),
  {
    prefix: '/organisations/:organisationId/documents',
    anchor: 'patient', // when relatedType = patient; staff documents are org-wide
    routes: {
      'GET /organisations/:organisationId/documents': covered,
      'POST /organisations/:organisationId/documents': covered,
      'GET /organisations/:organisationId/documents/related/:relatedType/:relatedId': covered,
      'GET /organisations/:organisationId/documents/:id': covered,
      'PATCH /organisations/:organisationId/documents/:id': covered,
      'POST /organisations/:organisationId/documents/:id/verify': reviewed(2), // same findOne check as GET/PATCH
      'DELETE /organisations/:organisationId/documents/:id': covered,
      'POST /organisations/:organisationId/documents/check-expired': orgWide('expiry sweep job'),
    },
  },
  {
    prefix: '/retreat/bookings',
    anchor: 'own',
    routes: {
      'GET /retreat/bookings': covered,
      'GET /retreat/bookings/:id': covered,
      'GET /retreat/bookings/calendar': covered,
      'POST /retreat/bookings/check-availability': gap(8, 'rooms-picker'),
      'POST /retreat/bookings': covered,
      'PATCH /retreat/bookings/:id': covered,
      'DELETE /retreat/bookings/:id': covered,
      'DELETE /retreat/bookings/:id/remove': covered,
      'PATCH /retreat/bookings/:id/refund': covered,
      'GET /retreat/bookings/:id/advances': covered,
      'POST /retreat/bookings/:id/advances': covered,
      'DELETE /retreat/bookings/:id/advances/:receiptId': covered,
      'POST /retreat/bookings/:id/promote': covered,
    },
  },
  {
    prefix: '/retreat/admissions',
    anchor: 'own',
    routes: {
      'GET /retreat/admissions': covered,
      'GET /retreat/admissions/stats': reviewed(3), // same branchFindCondition as the list
      'GET /retreat/admissions/:id': covered,
      'POST /retreat/admissions': covered, // room decides the branch; patient must match (G10)
      'POST /retreat/admissions/:id/discharge': covered,
      'PATCH /retreat/admissions/:id/delivery': covered,
    },
  },
  {
    prefix: '/retreat/enquiries',
    anchor: 'own', // after Phase 7 adds booking_enquiries.branch_id
    routes: {
      'GET /retreat/enquiries': gap(7, 'G12'),
      'POST /retreat/enquiries': gap(7, 'G12'),
      'PATCH /retreat/enquiries/:id': gap(7, 'G12'),
      'POST /retreat/enquiries/:id/convert': gap(7, 'G12'), // room branch (G10) covered; enquiry itself has no branch yet
      'POST /retreat/enquiries/:id/lost': gap(7, 'G12'),
    },
  },
  {
    prefix: '/retreat/today',
    anchor: 'own',
    routes: { 'GET /retreat/today': reviewed(3) }, // same branchFindCondition as the lists
  },
  {
    prefix: '/retreat/rooms',
    anchor: 'own',
    routes: {
      'GET /retreat/rooms': catalog,
      'POST /retreat/rooms': covered, // G10 write branch
      'PATCH /retreat/rooms/:id': covered,
      'DELETE /retreat/rooms/:id': covered,
      'GET /retreat/rooms/resolve-price': catalog,
      'GET /retreat/rooms/available': gap(8, 'rooms-picker'),
    },
  },
  {
    prefix: '/cash/receiving-ledgers',
    anchor: 'own',
    routes: { 'GET /cash/receiving-ledgers': covered }, // + posting re-checks drawer vs record branch
  },
  {
    prefix: '/analytics',
    anchor: 'none',
    routes: {
      'GET /analytics/clinic': covered, // restricted → 403; branch-filtered view is Phase 9
      'GET /analytics/procurement': covered, // restricted → 403; branch-filtered view is Phase 9
      'GET /analytics/procurement/base': orgWide('Ayurlahi team / org admin only (existing role gate)'),
      'GET /analytics/spend-summary': covered, // restricted → 403; branch-filtered view is Phase 9
      'GET /analytics/inventory-health': covered, // restricted → 403; branch-filtered view is Phase 9
      'GET /analytics/supplier-performance': covered, // restricted → 403; branch-filtered view is Phase 9
      'GET /analytics/postnatal-occupancy': covered, // restricted → 403; branch-filtered view is Phase 9
      'GET /analytics/dashboard': orgWide('Ayurlahi team dashboard'),
      'GET /analytics/telemetry': orgWide('Ayurlahi team'),
      'GET /analytics/feature-usage/by-org': orgWide('Ayurlahi team'),
      'GET /analytics/feature-usage/by-user': orgWide('Ayurlahi team'),
      'GET /analytics/marketplace-activity/by-org': orgWide('Ayurlahi team'),
      'GET /analytics/booking-activity/by-org': orgWide('Ayurlahi team'),
      'GET /analytics/marketplace': orgWide('Ayurlahi team'),
      'GET /analytics/funnels': orgWide('Ayurlahi team'),
      'GET /analytics/screen-to-action': orgWide('Ayurlahi team'),
      'POST /analytics/events': orgWide('usage telemetry ingestion'),
    },
  },
  {
    prefix: '/expenses',
    anchor: 'own',
    routes: {
      'GET /expenses': gap(8, 'S2'),
      'GET /expenses/:id': gap(8, 'S2'),
      'POST /expenses': gap(8, 'S2'),
      'PATCH /expenses/:id': gap(8, 'S2'),
      'DELETE /expenses/:id': gap(8, 'S2'),
    },
  },
  {
    prefix: '/organisations/:organisationId/purchase-orders',
    anchor: 'own',
    routes: {
      'GET /organisations/:organisationId/purchase-orders': gap(8, 'S4'),
      'GET /organisations/:organisationId/purchase-orders/:id': gap(8, 'S4'),
      'POST /organisations/:organisationId/purchase-orders': reviewed(8),
      'PATCH /organisations/:organisationId/purchase-orders/:id': reviewed(8),
      'DELETE /organisations/:organisationId/purchase-orders/:id': gap(8, 'S4'),
    },
  },
  {
    prefix: '/organisations/:organisationId/branches/switchable',
    anchor: 'own',
    routes: { 'GET /organisations/:organisationId/branches/switchable': covered },
  },
];

// Clinic orders/invoices (S3) are scoped by the inventory policy, and most
// /orders routes are the manufacturer's fulfilment workflow — tracked in the
// plan (§1d) rather than route-by-route here until Phase 8.

export const registryRouteKeys = (): Map<string, { area: BranchOwnedArea; status: RouteStatus }> => {
  const map = new Map<string, { area: BranchOwnedArea; status: RouteStatus }>();
  for (const area of BRANCH_OWNED_AREAS) {
    for (const [key, status] of Object.entries(area.routes)) map.set(key, { area, status });
  }
  return map;
};
