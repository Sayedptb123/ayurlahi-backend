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
      'GET /patients': reviewed(2),
      'GET /patients/possible-matches': reviewed(2),
      'GET /patients/:id': reviewed(2),
      'PATCH /patients/:id': gap(2, 'G4'),
      'DELETE /patients/:id': reviewed(2),
      'POST /patients': gap(4, 'G10'),
    },
  },
  {
    prefix: '/appointments',
    anchor: 'own',
    routes: {
      'GET /appointments': reviewed(3),
      'GET /appointments/:id': gap(2, 'G5'),
      'PATCH /appointments/:id': gap(2, 'G5'),
      'DELETE /appointments/:id': gap(2, 'G5'),
      'POST /appointments': gap(4, 'G10', 'G11'),
    },
  },
  {
    prefix: '/patient-billing',
    anchor: 'own',
    routes: {
      'GET /patient-billing': reviewed(3),
      'GET /patient-billing/:id': reviewed(3),
      'PATCH /patient-billing/:id': gap(3, 'G6'),
      'DELETE /patient-billing/:id': reviewed(3),
      'POST /patient-billing': gap(4, 'G10', 'G11'),
      'POST /patient-billing/:id/payment': reviewed(3),
      'GET /patient-billing/:id/payments': reviewed(3),
      'DELETE /patient-billing/:id/payments/:paymentId': reviewed(3),
    },
  },
  ...(['medical-records', 'prescriptions', 'lab-reports'] as const).map((r) => ({
    prefix: `/${r}`,
    anchor: 'patient' as const,
    routes: {
      [`GET /${r}`]: gap(2, 'G1'),
      [`GET /${r}/:id`]: gap(2, 'G1'),
      [`PATCH /${r}/:id`]: gap(2, 'G1'),
      [`DELETE /${r}/:id`]: gap(2, 'G1'),
      [`POST /${r}`]: gap(2, 'G1', 'G11'),
    },
  })),
  ...(['vitals', 'newborn-assessments'] as const).map((r) => ({
    prefix: `/organisations/:organisationId/${r}`,
    anchor: 'patient' as const,
    routes: {
      [`GET /organisations/:organisationId/${r}`]: gap(2, 'G1'),
      [`POST /organisations/:organisationId/${r}`]: gap(2, 'G1', 'G11'),
      [`DELETE /organisations/:organisationId/${r}/:id`]: gap(2, 'G1'),
    },
  })),
  {
    prefix: '/organisations/:organisationId/documents',
    anchor: 'patient', // when relatedType = patient; staff documents are org-wide
    routes: {
      'GET /organisations/:organisationId/documents': gap(2, 'G13'),
      'POST /organisations/:organisationId/documents': gap(2, 'G13'),
      'GET /organisations/:organisationId/documents/related/:relatedType/:relatedId': gap(2, 'G13'),
      'GET /organisations/:organisationId/documents/:id': gap(2, 'G13'),
      'PATCH /organisations/:organisationId/documents/:id': gap(2, 'G13'),
      'POST /organisations/:organisationId/documents/:id/verify': gap(2, 'G13'),
      'DELETE /organisations/:organisationId/documents/:id': gap(2, 'G13'),
      'POST /organisations/:organisationId/documents/check-expired': orgWide('expiry sweep job'),
    },
  },
  {
    prefix: '/retreat/bookings',
    anchor: 'own',
    routes: {
      'GET /retreat/bookings': reviewed(3),
      'GET /retreat/bookings/:id': reviewed(3),
      'GET /retreat/bookings/calendar': reviewed(3),
      'POST /retreat/bookings/check-availability': gap(8, 'rooms-picker'),
      'POST /retreat/bookings': gap(4, 'G10'),
      'PATCH /retreat/bookings/:id': gap(3, 'G2'),
      'DELETE /retreat/bookings/:id': gap(3, 'G2'),
      'DELETE /retreat/bookings/:id/remove': gap(3, 'G2'),
      'PATCH /retreat/bookings/:id/refund': gap(3, 'G2'),
      'GET /retreat/bookings/:id/advances': gap(3, 'G2'),
      'POST /retreat/bookings/:id/advances': gap(3, 'G2'),
      'DELETE /retreat/bookings/:id/advances/:receiptId': gap(3, 'G2'),
      'POST /retreat/bookings/:id/promote': gap(3, 'G2'),
    },
  },
  {
    prefix: '/retreat/admissions',
    anchor: 'own',
    routes: {
      'GET /retreat/admissions': reviewed(3),
      'GET /retreat/admissions/stats': reviewed(3),
      'GET /retreat/admissions/:id': reviewed(3),
      'POST /retreat/admissions': gap(4, 'G11'),
      'POST /retreat/admissions/:id/discharge': gap(3, 'G3'),
      'PATCH /retreat/admissions/:id/delivery': gap(3, 'G3'),
    },
  },
  {
    prefix: '/retreat/enquiries',
    anchor: 'own', // after Phase 7 adds booking_enquiries.branch_id
    routes: {
      'GET /retreat/enquiries': gap(7, 'G12'),
      'POST /retreat/enquiries': gap(7, 'G12'),
      'PATCH /retreat/enquiries/:id': gap(7, 'G12'),
      'POST /retreat/enquiries/:id/convert': gap(7, 'G12', 'G2'),
      'POST /retreat/enquiries/:id/lost': gap(7, 'G12'),
    },
  },
  {
    prefix: '/retreat/today',
    anchor: 'own',
    routes: { 'GET /retreat/today': reviewed(3) },
  },
  {
    prefix: '/retreat/rooms',
    anchor: 'own',
    routes: {
      'GET /retreat/rooms': catalog,
      'POST /retreat/rooms': catalog,
      'PATCH /retreat/rooms/:id': catalog,
      'DELETE /retreat/rooms/:id': catalog,
      'GET /retreat/rooms/resolve-price': catalog,
      'GET /retreat/rooms/available': gap(8, 'rooms-picker'),
    },
  },
  {
    prefix: '/cash/receiving-ledgers',
    anchor: 'own',
    routes: { 'GET /cash/receiving-ledgers': gap(5, 'G7') },
  },
  {
    prefix: '/analytics',
    anchor: 'none',
    routes: {
      'GET /analytics/clinic': gap(5, 'G9'),
      'GET /analytics/procurement': gap(5, 'G9'),
      'GET /analytics/procurement/base': gap(5, 'G9'),
      'GET /analytics/spend-summary': gap(5, 'G9'),
      'GET /analytics/inventory-health': gap(5, 'G9'),
      'GET /analytics/supplier-performance': gap(5, 'G9'),
      'GET /analytics/postnatal-occupancy': gap(5, 'G9'),
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
