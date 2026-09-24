/**
 * Branch isolation contract suite — scope/Branch_Scoping_Remediation_Plan_2026-09-24.md §9, §11.
 *
 * Boots the real AppModule against the configured (staging) DB, like
 * analytics-top-selling.e2e-spec.ts, and calls the real HTTP routes with
 * minted JWTs for fixture users of a dedicated fixture organisation:
 *
 *   "ZZ Branch Isolation Fixture (internal — do not approve)" — rejected,
 *   patient_visibility = isolated, Branch A + Branch B. Created once,
 *   idempotently, and reused across runs; rows a run creates are soft-deleted.
 *
 * Tests assert the FINAL rules (Q1: NULL-branch rows hidden from restricted
 * users in a branched org; Q2: 404 across branches; Q3: write branch
 * resolution). Where current code does not meet them yet, the test is
 * `test.failing` with the gap id: it proves the gap on the real DB today and
 * turns into a failure the moment the gap is fixed, forcing the registry and
 * this suite to be updated together.
 *
 * Run: npm run test:e2e -- --testPathPattern=branch-isolation --runInBand
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, RequestMethod } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BRANCH_OWNED_AREAS, registryRouteKeys } from '../src/branch-visibility/branch-ownership.registry';

const ORG_NAME = 'ZZ Branch Isolation Fixture (internal — do not approve)';
const SHARED_PHONE = '9000000777';
const RUN = `${Date.now()}`;

type Role = 'owner' | 'manager' | 'restrictedA' | 'doctorA' | 'multiAB' | 'unassigned';
// `n` is a fixed per-user suffix for the (globally unique) fixture phone number.
const USERS: Record<Role, { n: number; role: string; staffBranches?: ('A' | 'B')[] }> = {
  owner: { n: 1, role: 'OWNER' },
  manager: { n: 2, role: 'MANAGER' },
  restrictedA: { n: 3, role: 'RECEPTIONIST', staffBranches: ['A'] },
  multiAB: { n: 4, role: 'NURSE', staffBranches: ['A', 'B'] },
  unassigned: { n: 5, role: 'STAFF', staffBranches: [] },
  doctorA: { n: 6, role: 'DOCTOR', staffBranches: ['A'] }, // only doctors (+ leadership) may prescribe
};

type Side = 'A' | 'B';
type PatientLinked = 'medicalRecord' | 'prescription' | 'labReport' | 'vital' | 'newborn' | 'appointment' | 'document';
type Stay = 'room' | 'freeRoom' | 'booking' | 'admission' | 'bill';

interface Fixture {
  orgId: string;
  branchA: string;
  branchB: string;
  userIds: Record<Role, string>;
  doctorStaffId: string;
  patients: { A: string; B: string; NULL: string };
  records: Record<PatientLinked, Record<Side, string>>;
  stays: Record<Stay, Record<Side, string>>;
  enquiries: { A: string; B: string; NULL: string };
  procurement: { order: Record<'A' | 'B' | 'NULL', string>; invoice: Record<Side, string>; po: Record<Side, string>; expense: Record<'A' | 'B' | 'NULL', string> };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ensureFixture(ds: DataSource): Promise<Fixture> {
  const one = async (sql: string, params: any[]) => (await ds.query(sql, params))[0];

  let org = await one(`SELECT id FROM organisations WHERE name = $1 AND type = 'CLINIC' LIMIT 1`, [ORG_NAME]);
  if (!org) {
    org = await one(
      `INSERT INTO organisations (name, type, approval_status) VALUES ($1, 'CLINIC', 'rejected') RETURNING id`,
      [ORG_NAME],
    );
  }
  const orgId: string = org.id;
  await ds.query(
    `INSERT INTO organisation_settings (organisation_id, patient_visibility)
     SELECT $1, 'isolated' WHERE NOT EXISTS (SELECT 1 FROM organisation_settings WHERE organisation_id = $1)`,
    [orgId],
  );
  await ds.query(`UPDATE organisation_settings SET patient_visibility = 'isolated' WHERE organisation_id = $1`, [orgId]);
  // Procurement data (orders / invoices / POs) follows the INVENTORY policy.
  await ds.query(`UPDATE organisation_settings SET inventory_policy = 'per_branch' WHERE organisation_id = $1`, [orgId]);
  // Newborn assessments sit behind the postnatal capability.
  await ds.query(
    `INSERT INTO clinic_capabilities (organisation_id, has_postnatal_care)
     SELECT $1, true WHERE NOT EXISTS (SELECT 1 FROM clinic_capabilities WHERE organisation_id = $1)`,
    [orgId],
  );
  await ds.query(`UPDATE clinic_capabilities SET has_postnatal_care = true WHERE organisation_id = $1`, [orgId]);
  // Booking / billing routes sit behind module flags: enable them all.
  await ds.query(
    `UPDATE clinic_capabilities SET enabled_modules = '["booking","rooms","enquiries","postnatal_care","ipd","opd","appointments","billing","patients","medical_records","prescriptions","lab_reports"]'
      WHERE organisation_id = $1`,
    [orgId],
  );

  const branch = async (name: string, primary: boolean) => {
    const found = await one(`SELECT id FROM branches WHERE organisation_id = $1 AND name = $2 AND deleted_at IS NULL`, [orgId, name]);
    if (found) return found.id as string;
    return (await one(
      `INSERT INTO branches (organisation_id, name, is_primary, approval_status) VALUES ($1, $2, $3, 'approved') RETURNING id`,
      [orgId, name, primary],
    )).id as string;
  };
  const branchA = await branch('ZZ Fixture Branch A', true);
  const branchB = await branch('ZZ Fixture Branch B', false);
  const branchId = { A: branchA, B: branchB };

  const userIds = {} as Record<Role, string>;
  const staffIds = {} as Record<Role, string>;
  for (const [key, spec] of Object.entries(USERS) as [Role, (typeof USERS)[Role]][]) {
    const email = `zz-branch-fixture-${key.toLowerCase()}@example.invalid`;
    let user = await one(`SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]);
    if (!user) {
      user = await one(
        `INSERT INTO users (first_name, last_name, email, phone) VALUES ('ZZ Fixture', $1, $2, $3) RETURNING id`,
        [key, email, `+9900000${String(spec.n).padStart(4, '0')}`],
      );
    }
    userIds[key] = user.id;
    await ds.query(
      `INSERT INTO organisation_users (user_id, organisation_id, role, is_active)
       SELECT $1, $2, $3, true WHERE NOT EXISTS (SELECT 1 FROM organisation_users WHERE user_id = $1 AND organisation_id = $2)`,
      [user.id, orgId, spec.role],
    );
    if (spec.staffBranches) {
      let staff = await one(`SELECT id FROM staff WHERE user_id = $1 AND organisation_id = $2`, [user.id, orgId]);
      if (!staff) {
        staff = await one(
          `INSERT INTO staff (organisation_id, user_id, first_name, last_name, position) VALUES ($1, $2, 'ZZ Fixture', $3, 'receptionist') RETURNING id`,
          [orgId, user.id, key],
        );
      }
      staffIds[key] = staff.id;
      for (const b of spec.staffBranches) {
        await ds.query(
          `INSERT INTO staff_branch_assignments (organisation_id, staff_id, branch_id, is_active)
           SELECT $1, $2, $3, true WHERE NOT EXISTS (
             SELECT 1 FROM staff_branch_assignments WHERE staff_id = $2 AND branch_id = $3 AND is_active AND deleted_at IS NULL)`,
          [orgId, staff.id, branchId[b]],
        );
      }
    }
  }

  const patient = async (code: string, branch: string | null) => {
    const found = await one(`SELECT id FROM patients WHERE organisation_id = $1 AND patient_code = $2 AND deleted_at IS NULL`, [orgId, code]);
    if (found) return found.id as string;
    return (await one(
      `INSERT INTO patients (organisation_id, patient_code, first_name, last_name, phone, branch_id)
       VALUES ($1, $2, 'ZZFixture', $3, $4, $5) RETURNING id`,
      [orgId, code, code, SHARED_PHONE, branch],
    )).id as string;
  };
  const patients = {
    A: await patient('ZZBF-A', branchA),
    B: await patient('ZZBF-B', branchB),
    NULL: await patient('ZZBF-NULL', null),
  };

  // One patient-linked record of each kind per branch, found again by a marker.
  const doctorStaffId = staffIds.multiAB;
  const ownerUserId = userIds.owner;
  const record = async (findSql: string, insertSql: string, params: any[]) =>
    ((await one(findSql, [orgId, params[1]])) ?? (await one(insertSql, params))).id as string;
  const records = {} as Fixture['records'];
  for (const k of ['medicalRecord', 'prescription', 'labReport', 'vital', 'newborn', 'appointment', 'document'] as PatientLinked[]) records[k] = {} as any;
  for (const side of ['A', 'B'] as Side[]) {
    const pid = patients[side];
    const tag = `ZZBF-${side}`;
    records.medicalRecord[side] = await record(
      `SELECT id FROM medical_records WHERE organisation_id = $1 AND chief_complaint = $2 AND deleted_at IS NULL`,
      `INSERT INTO medical_records (organisation_id, chief_complaint, patient_id, doctor_id, visit_date, diagnosis, treatment)
       VALUES ($1, $2, $3, $4, '2026-01-01', 'fixture', 'fixture') RETURNING id`,
      [orgId, tag, pid, doctorStaffId]);
    records.prescription[side] = await record(
      `SELECT id FROM prescriptions WHERE organisation_id = $1 AND diagnosis = $2 AND deleted_at IS NULL`,
      `INSERT INTO prescriptions (organisation_id, diagnosis, patient_id, doctor_id, prescription_date)
       VALUES ($1, $2, $3, $4, '2026-01-01') RETURNING id`,
      [orgId, tag, pid, doctorStaffId]);
    records.labReport[side] = await record(
      `SELECT id FROM lab_reports WHERE organisation_id = $1 AND report_number = $2 AND deleted_at IS NULL`,
      `INSERT INTO lab_reports (organisation_id, report_number, patient_id, doctor_id, order_date)
       VALUES ($1, $2, $3, $4, '2026-01-01') RETURNING id`,
      [orgId, tag, pid, doctorStaffId]);
    records.vital[side] = await record(
      `SELECT id FROM vitals WHERE organisation_id = $1 AND notes = $2 AND deleted_at IS NULL`,
      `INSERT INTO vitals (organisation_id, notes, patient_id, recorded_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, tag, pid, ownerUserId]);
    records.newborn[side] = await record(
      `SELECT id FROM newborn_assessments WHERE "organisationId" = $1 AND notes = $2 AND deleted_at IS NULL`,
      `INSERT INTO newborn_assessments ("organisationId", notes, "patientId", "assessedBy", "assessmentTime", "assessmentType")
       VALUES ($1, $2, $3, $4, now(), 'general') RETURNING id`,
      [orgId, tag, pid, ownerUserId]);
    records.appointment[side] = await record(
      `SELECT id FROM appointments WHERE organisation_id = $1 AND notes = $2 AND deleted_at IS NULL`,
      `INSERT INTO appointments (organisation_id, notes, patient_id, doctor_id, appointment_date, appointment_time, branch_id)
       VALUES ($1, $2, $3, $4, '2027-01-01', '10:00', $5) RETURNING id`,
      [orgId, tag, pid, doctorStaffId, branchId[side]]);
    records.document[side] = await record(
      `SELECT id FROM documents WHERE organisation_id = $1 AND name = $2 AND deleted_at IS NULL`,
      `INSERT INTO documents (organisation_id, name, related_type, related_id, file_name, file_path)
       VALUES ($1, $2, 'patient', $3, 'fixture.pdf', 'fixtures/fixture.pdf') RETURNING id`,
      [orgId, tag, pid]);
  }

  // Stays: one room / confirmed booking / active admission / bill per branch.
  const stays = { room: {}, freeRoom: {}, booking: {}, admission: {}, bill: {} } as Fixture['stays'];
  for (const side of ['A', 'B'] as Side[]) {
    const pid = patients[side];
    const tag = `ZZBF-${side}`;
    stays.room[side] = await record(
      `SELECT id FROM rooms WHERE organisation_id = $1 AND room_number = $2 AND deleted_at IS NULL`,
      `INSERT INTO rooms (organisation_id, room_number, branch_id) VALUES ($1, $2, $3) RETURNING id`,
      [orgId, tag, branchId[side]]);
    // Never occupied: Phase 4 write tests book it (far-future, per-run dates).
    stays.freeRoom[side] = await record(
      `SELECT id FROM rooms WHERE organisation_id = $1 AND room_number = $2 AND deleted_at IS NULL`,
      `INSERT INTO rooms (organisation_id, room_number, branch_id) VALUES ($1, $2, $3) RETURNING id`,
      [orgId, `${tag}-FREE`, branchId[side]]);
    stays.booking[side] = await record(
      `SELECT id FROM room_bookings WHERE organisation_id = $1 AND notes = $2 AND deleted_at IS NULL`,
      `INSERT INTO room_bookings (organisation_id, notes, room_id, patient_id, check_in_date, check_out_date, total_price, status, branch_id)
       VALUES ($1, $2, $3, $4, '2029-01-01', '2029-01-05', 1000, 'CONFIRMED', $5) RETURNING id`,
      [orgId, tag, stays.room[side], pid, branchId[side]]);
    stays.admission[side] = await record(
      `SELECT id FROM admissions WHERE organisation_id = $1 AND notes = $2`,
      `INSERT INTO admissions (organisation_id, notes, patient_id, room_id, check_in_date, status, branch_id)
       VALUES ($1, $2, $3, $4, now(), 'ACTIVE', $5) RETURNING id`,
      [orgId, tag, pid, stays.room[side], branchId[side]]);
    stays.bill[side] = await record(
      `SELECT id FROM patient_bills WHERE organisation_id = $1 AND bill_number = $2 AND deleted_at IS NULL`,
      `INSERT INTO patient_bills (organisation_id, bill_number, patient_id, bill_date, subtotal, status, branch_id)
       VALUES ($1, $2, $3, '2026-01-01', 100, 'pending', $4) RETURNING id`,
      [orgId, tag, pid, branchId[side]]);
  }

  // Enquiries: one per branch + one legacy NULL-branch row (Q1: owner-only).
  const enquiry = async (tag: string, branch: string | null) => record(
    `SELECT id FROM booking_enquiries WHERE organisation_id = $1 AND contact_name = $2 AND deleted_at IS NULL`,
    `INSERT INTO booking_enquiries (organisation_id, contact_name, phone, channel, status, branch_id)
     VALUES ($1, $2, '9000000999', 'PHONE', 'NEW', $3) RETURNING id`,
    [orgId, tag, branch]);
  const enquiries = {
    A: await enquiry('ZZBF-ENQ-A', branchA),
    B: await enquiry('ZZBF-ENQ-B', branchB),
    NULL: await enquiry('ZZBF-ENQ-NULL', null),
  };

  // Procurement + expenses: one row per branch (+ NULL where Q1 matters).
  const [supplier] = await ds.query(`SELECT id FROM suppliers WHERE organisation_id = $1 AND name = 'ZZBF Supplier'`, [orgId]);
  const supplierId = supplier?.id ?? (await one(`INSERT INTO suppliers (organisation_id, name) VALUES ($1, 'ZZBF Supplier') RETURNING id`, [orgId])).id;
  const order = (tag: string, branch: string | null) => record(
    `SELECT id FROM orders WHERE organisation_id = $1 AND order_number = $2`,
    `INSERT INTO orders (organisation_id, order_number, subtotal, total_amount, source, branch_id) VALUES ($1, $2, 1, 1, 'app', $3) RETURNING id`,
    [orgId, tag, branch]);
  const expense = (tag: string, branch: string | null) => record(
    `SELECT id FROM expenses WHERE organisation_id = $1 AND description = $2 AND deleted_at IS NULL`,
    `INSERT INTO expenses (organisation_id, description, amount, expense_date, created_by, category, status, branch_id)
     VALUES ($1, $2, 1, '2026-09-01', $3, 'operations', 'pending', $4) RETURNING id`,
    [orgId, tag, userIds.owner, branch]);
  const procurement = {
    order: { A: await order('ZZBF-ORD-A', branchA), B: await order('ZZBF-ORD-B', branchB), NULL: await order('ZZBF-ORD-NULL', null) },
    invoice: {} as Record<Side, string>,
    po: {} as Record<Side, string>,
    expense: { A: await expense('ZZBF-EXP-A', branchA), B: await expense('ZZBF-EXP-B', branchB), NULL: await expense('ZZBF-EXP-NULL', null) },
  };
  for (const side of ['A', 'B'] as Side[]) {
    procurement.invoice[side] = (
      (await one(`SELECT id FROM invoices WHERE "invoiceNumber" = $1`, [`ZZBF-INV-${side}`])) ??
      (await one(`INSERT INTO invoices ("invoiceNumber", "orderId", "invoiceDate", "totalAmount", "clinicDetails", items, subtotal, "gstAmount", "shippingCharges", "platformFee")
                  VALUES ($1, $2, '2026-09-01', 1, '{}', '[]', 1, 0, 0, 0) RETURNING id`, [`ZZBF-INV-${side}`, procurement.order[side]]))
    ).id;
    procurement.po[side] = await record(
      `SELECT id FROM purchase_orders WHERE organisation_id = $1 AND po_number = $2`,
      `INSERT INTO purchase_orders (organisation_id, po_number, supplier_id, branch_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, `ZZBF-PO-${side}`, supplierId, branchId[side]]);
  }

  // Analytics fixture (Phase 9): activity in Branch A only for revenue and
  // off-platform spend, so Branch B must aggregate to exactly zero; branch
  // stock in both branches (A low, B healthy).
  await record(
    `SELECT id FROM patient_bills WHERE organisation_id = $1 AND bill_number = $2 AND deleted_at IS NULL`,
    `INSERT INTO patient_bills (organisation_id, bill_number, patient_id, bill_date, subtotal, paid_amount, status, branch_id)
     VALUES ($1, $2, $3, '2026-01-02', 100, 100, 'paid', $4) RETURNING id`,
    [orgId, 'ZZBF-PAID-A', patients.A, branchA]);
  await record(
    `SELECT id FROM purchase_orders WHERE organisation_id = $1 AND po_number = $2`,
    `INSERT INTO purchase_orders (organisation_id, po_number, supplier_id, branch_id, status, total_amount, order_date, received_at)
     VALUES ($1, $2, $3, $4, 'received', 250, '2026-01-01', '2026-01-05') RETURNING id`,
    [orgId, 'ZZBF-PO-RCV-A', supplierId, branchA]);
  const master = await record(
    `SELECT id FROM inventory_item_masters WHERE organisation_id = $1 AND name = $2 AND deleted_at IS NULL`,
    `INSERT INTO inventory_item_masters (organisation_id, name, unit, cost_price) VALUES ($1, $2, 'Unit', 10) RETURNING id`,
    [orgId, 'ZZBF Item']);
  for (const [branch, stock] of [[branchA, 2], [branchB, 10]] as [string, number][]) {
    await ds.query(
      `INSERT INTO inventory_branch_stock (organisation_id, item_master_id, branch_id, current_stock, min_stock_level)
       SELECT $1, $2, $3, $4, 5 WHERE NOT EXISTS (SELECT 1 FROM inventory_branch_stock WHERE item_master_id = $2 AND branch_id = $3)`,
      [orgId, master, branch, stock]);
  }

  return { orgId, branchA, branchB, userIds, doctorStaffId, patients, records, stays, enquiries, procurement };
}

// Every request crosses to the staging DB (Mumbai); the 5 s default is too tight.
jest.setTimeout(30000);

describe('Branch isolation contract (real DB)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let fx: Fixture;
  const tokens = {} as Record<Role, string>;
  const createdPatientIds: string[] = [];
  const createdLinked: { table: string; id: string }[] = [];

  const api = (role: Role) => {
    const auth = { Authorization: `Bearer ${tokens[role]}` };
    // Paced + retried on 429 so the global rate limiter (10 req/s) can never
    // turn into a false pass/fail.
    const send = async (make: () => request.Test): Promise<request.Response> => {
      for (let attempt = 0; ; attempt++) {
        await sleep(150);
        const res = await make().set(auth);
        if (res.status !== 429 || attempt >= 4) return res;
        await sleep(1100);
      }
    };
    const http = () => request(app.getHttpServer());
    return {
      get: (url: string) => send(() => http().get(`/api${url}`)),
      post: (url: string, body: any) => send(() => http().post(`/api${url}`).send(body)),
      patch: (url: string, body: any) => send(() => http().patch(`/api${url}`).send(body)),
      delete: (url: string) => send(() => http().delete(`/api${url}`)),
    };
  };
  const ids = (res: request.Response): string[] =>
    (Array.isArray(res.body) ? res.body : res.body?.data ?? []).map((r: any) => r.id);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    ds = app.get(DataSource);
    fx = await ensureFixture(ds);
    const jwt = app.get(JwtService, { strict: false });
    for (const role of Object.keys(USERS) as Role[]) {
      tokens[role] = jwt.sign({
        sub: fx.userIds[role],
        email: `zz-branch-fixture-${role.toLowerCase()}@example.invalid`,
        organisationId: fx.orgId,
        organisationType: 'CLINIC',
        role: USERS[role].role,
      });
    }
  }, 60000);

  afterAll(async () => {
    for (const { table, id } of createdLinked) {
      await ds.query(`UPDATE ${table} SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]);
    }
    if (createdPatientIds.length) {
      await ds.query(`UPDATE patients SET deleted_at = now() WHERE id = ANY($1) AND deleted_at IS NULL`, [createdPatientIds]);
    }
    await app?.close();
  });

  // ── Route-coverage guard ──────────────────────────────────────────────────
  describe('route-coverage guard', () => {
    const allRoutes = (): string[] => {
      const discovery = app.get(DiscoveryService);
      const scanner = app.get(MetadataScanner);
      const out: string[] = [];
      for (const wrapper of discovery.getControllers()) {
        const { metatype, instance } = wrapper;
        if (!metatype || !instance) continue;
        const base = [Reflect.getMetadata(PATH_METADATA, metatype)].flat()[0] ?? '';
        for (const name of scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
          const handler = instance[name];
          const path = Reflect.getMetadata(PATH_METADATA, handler);
          const method = Reflect.getMetadata(METHOD_METADATA, handler);
          if (path === undefined || method === undefined) continue;
          const full = ('/' + [base, [path].flat()[0]].filter((p) => p && p !== '/').join('/')).replace(/\/+/g, '/').replace(/\/$/, '');
          out.push(`${RequestMethod[method]} ${full || '/'}`);
        }
      }
      return out;
    };

    it('every route under a branch-owned prefix is listed in the registry', () => {
      const registry = registryRouteKeys();
      const prefixes = BRANCH_OWNED_AREAS.map((a) => a.prefix);
      const unlisted = allRoutes().filter((key) => {
        const path = key.split(' ')[1];
        return prefixes.some((p) => path === p || path.startsWith(`${p}/`)) && !registry.has(key);
      });
      expect(unlisted).toEqual([]);
    });

    it('every registry entry is a real route (no stale entries)', () => {
      const routes = new Set(allRoutes());
      expect([...registryRouteKeys().keys()].filter((k) => !routes.has(k))).toEqual([]);
    });
  });

  // ── Branch switcher (covered) ─────────────────────────────────────────────
  describe('GET /organisations/:id/branches/switchable', () => {
    const names = async (role: Role) =>
      ids(await api(role).get(`/organisations/${fx.orgId}/branches/switchable`)).sort();

    it('restricted user gets only their branch', async () => expect(await names('restrictedA')).toEqual([fx.branchA]));
    it('multi-branch user gets both', async () => expect(await names('multiAB')).toEqual([fx.branchA, fx.branchB].sort()));
    it('unassigned user gets none', async () => expect(await names('unassigned')).toEqual([]));
    it('owner and manager get all', async () => {
      expect(await names('owner')).toEqual([fx.branchA, fx.branchB].sort());
      expect(await names('manager')).toEqual([fx.branchA, fx.branchB].sort());
    });
    it('another organisation id → 403', async () => {
      const res = await api('restrictedA').get(`/organisations/00000000-0000-4000-8000-000000000000/branches/switchable`);
      expect(res.status).toBe(403);
    });
  });

  // ── Patients (reviewed → covered in Phase 2) ──────────────────────────────
  describe('patients', () => {
    it('restricted list never returns another branch (with or without branchId)', async () => {
      expect(ids(await api('restrictedA').get('/patients?limit=100'))).not.toContain(fx.patients.B);
      expect(ids(await api('restrictedA').get(`/patients?limit=100&branchId=${fx.branchB}`))).not.toContain(fx.patients.B);
      expect(ids(await api('restrictedA').get('/patients?limit=100'))).toContain(fx.patients.A);
    });
    it('[Q1] restricted list hides NULL-branch patients', async () => {
      expect(ids(await api('restrictedA').get('/patients?limit=100'))).not.toContain(fx.patients.NULL);
    });
    it('[Q1] unassigned user sees no patients at all', async () => {
      expect(ids(await api('unassigned').get('/patients?limit=100'))).toEqual([]);
    });
    it('multi-branch user sees both branches; switcher narrows', async () => {
      const all = ids(await api('multiAB').get('/patients?limit=100'));
      expect(all).toEqual(expect.arrayContaining([fx.patients.A, fx.patients.B]));
      const onlyB = ids(await api('multiAB').get(`/patients?limit=100&branchId=${fx.branchB}`));
      expect(onlyB).toContain(fx.patients.B);
      expect(onlyB).not.toContain(fx.patients.A);
    });
    it('owner sees every branch and NULL rows; switcher narrows', async () => {
      expect(ids(await api('owner').get('/patients?limit=100'))).toEqual(
        expect.arrayContaining([fx.patients.A, fx.patients.B, fx.patients.NULL]),
      );
      expect(ids(await api('owner').get(`/patients?limit=100&branchId=${fx.branchA}`))).toEqual([fx.patients.A]);
    });

    it("restricted user cannot read another branch's patient by id", async () => {
      const res = await api('restrictedA').get(`/patients/${fx.patients.B}`);
      expect(res.status).not.toBe(200);
    });
    it('[Q2] …and gets 404, not 403', async () => {
      expect((await api('restrictedA').get(`/patients/${fx.patients.B}`)).status).toBe(404);
    });

    // Sends the patient's own current lastName, so even a wrongly-accepted
    // update changes nothing.
    it("[G4] restricted user cannot update another branch's patient", async () => {
      const res = await api('restrictedA').patch(`/patients/${fx.patients.B}`, { lastName: 'ZZBF-B' });
      expect(res.status).toBe(404);
    });

    it("restricted user cannot delete another branch's patient (404, row survives)", async () => {
      const res = await api('restrictedA').delete(`/patients/${fx.patients.B}`);
      expect(res.status).toBe(404);
      const [row] = await ds.query(`SELECT deleted_at FROM patients WHERE id = $1`, [fx.patients.B]);
      expect(row.deleted_at).toBeNull();
    });

    it('[G10] restricted user cannot create a patient in another branch (nothing written)', async () => {
      const res = await api('restrictedA').post('/patients', { firstName: 'ZZForged', lastName: RUN, branchId: fx.branchB });
      if (res.body?.id) createdPatientIds.push(res.body.id);
      expect(res.status).toBe(403);
      const [{ n }] = await ds.query(`SELECT count(*)::int n FROM patients WHERE organisation_id = $1 AND first_name = 'ZZForged' AND last_name = $2`, [fx.orgId, RUN]);
      expect(n).toBe(0);
    });
    it('[G10/Q3] create without branchId lands in the single usable branch', async () => {
      const res = await api('restrictedA').post('/patients', { firstName: 'ZZNoBranch', lastName: RUN });
      if (res.body?.id) createdPatientIds.push(res.body.id);
      expect(res.body?.branchId).toBe(fx.branchA);
    });
    it('[Q3] multi-branch user: no branch → 400; explicit branch → that branch', async () => {
      expect((await api('multiAB').post('/patients', { firstName: 'ZZAmbiguous', lastName: RUN })).status).toBe(400);
      const res = await api('multiAB').post('/patients', { firstName: 'ZZMultiB', lastName: RUN, branchId: fx.branchB });
      if (res.body?.id) createdPatientIds.push(res.body.id);
      expect(res.status).toBe(201);
      expect(res.body.branchId).toBe(fx.branchB);
    });
    it("[G10] a newborn takes the mother's branch; another branch's mother → 404", async () => {
      expect((await api('restrictedA').post('/patients', { firstName: 'ZZBaby', lastName: RUN, motherPatientId: fx.patients.B })).status).toBe(404);
      const res = await api('restrictedA').post('/patients', { firstName: 'ZZBaby', lastName: RUN, motherPatientId: fx.patients.A });
      if (res.body?.id) createdPatientIds.push(res.body.id);
      expect(res.body?.branchId).toBe(fx.branchA);
      expect((await api('multiAB').post('/patients', { firstName: 'ZZBaby', lastName: RUN, motherPatientId: fx.patients.A, branchId: fx.branchB })).status).toBe(400);
    });
    it('restricted user can move a patient only into a branch they can use', async () => {
      const res = await api('restrictedA').patch(`/patients/${fx.patients.A}`, { branchId: fx.branchB });
      expect(res.status).toBe(403);
      const [row] = await ds.query(`SELECT branch_id FROM patients WHERE id = $1`, [fx.patients.A]);
      expect(row.branch_id).toBe(fx.branchA);
    });

    it('restricted user can create a patient in their own branch', async () => {
      const res = await api('restrictedA').post('/patients', { firstName: 'ZZOwnBranch', lastName: RUN, branchId: fx.branchA });
      if (res.body?.id) createdPatientIds.push(res.body.id);
      expect(res.status).toBe(201);
      expect(res.body.branchId).toBe(fx.branchA);
    });

    it('possible-matches never reveals another branch', async () => {
      expect(ids(await api('restrictedA').get(`/patients/possible-matches?phone=${SHARED_PHONE}`))).not.toContain(fx.patients.B);
    });
    it('[Q1] possible-matches hides NULL-branch patients from restricted users', async () => {
      expect(ids(await api('restrictedA').get(`/patients/possible-matches?phone=${SHARED_PHONE}`))).not.toContain(fx.patients.NULL);
    });
  });
  // ── Patient-linked records (Phase 2: G1, G5, G11, G13) ────────────────────
  const today = '2026-09-24';
  const runDate = () => new Date(Date.UTC(2028, 0, 1) + (Number(RUN) % 3000) * 86400000).toISOString().slice(0, 10);
  const LINKED: {
    key: PatientLinked;
    base: () => string;
    listKey?: 'data' | 'array';
    detail: boolean;
    actor?: Role; // branch-A-restricted caller allowed to write this kind
    patch?: (side: Side) => any;
    create: (patientId: string) => any;
  }[] = [
    { key: 'medicalRecord', base: () => '/medical-records', detail: true,
      patch: (side) => ({ chiefComplaint: `ZZBF-${side}` }),
      create: (patientId) => ({ patientId, doctorId: fx.doctorStaffId, visitDate: today, chiefComplaint: `ZZRun-${RUN}`, diagnosis: 'x', treatment: 'x' }) },
    { key: 'prescription', base: () => '/prescriptions', detail: true, actor: 'doctorA',
      patch: (side) => ({ diagnosis: `ZZBF-${side}` }),
      create: (patientId) => ({ patientId, doctorId: fx.doctorStaffId, prescriptionDate: today, diagnosis: `ZZRun-${RUN}`, items: [{ medicineName: 'x' }] }) },
    { key: 'labReport', base: () => '/lab-reports', detail: true,
      patch: (side) => ({ reportNumber: `ZZBF-${side}` }),
      create: (patientId) => ({ patientId, doctorId: fx.doctorStaffId, orderDate: today, reportNumber: `ZZRun-${RUN}-${patientId.slice(0, 4)}`, tests: [{ testName: 'x' }] }) },
    { key: 'appointment', base: () => '/appointments', detail: true,
      patch: (side) => ({ notes: `ZZBF-${side}` }),
      // A fresh slot per run so a doctor double-booking check can't interfere.
      create: (patientId) => ({ patientId, doctorId: fx.doctorStaffId, appointmentDate: runDate(), appointmentTime: '11:00' }) },
    { key: 'vital', base: () => `/organisations/${fx.orgId}/vitals`, detail: false,
      create: (patientId) => ({ patientId, recordedAt: new Date().toISOString(), notes: `ZZRun-${RUN}` }) },
    { key: 'newborn', base: () => `/organisations/${fx.orgId}/newborn-assessments`, detail: false,
      create: (patientId) => ({ patientId, assessmentTime: new Date().toISOString(), assessmentType: 'general', notes: `ZZRun-${RUN}` }) },
  ];
  const TABLE: Record<string, string> = {
    medicalRecord: 'medical_records', prescription: 'prescriptions', labReport: 'lab_reports',
    appointment: 'appointments', vital: 'vitals', newborn: 'newborn_assessments', document: 'documents',
  };

  for (const r of LINKED) {
    describe(`${r.key} (patient-linked)`, () => {
      const rec = (side: Side) => fx.records[r.key][side];

      it('restricted list: own branch only, also when branchId / patientId point at Branch B', async () => {
        const own = ids(await api(r.actor ?? 'restrictedA').get(`${r.base()}?limit=100`));
        expect(own).toContain(rec('A'));
        expect(own).not.toContain(rec('B'));
        expect(ids(await api(r.actor ?? 'restrictedA').get(`${r.base()}?limit=100&branchId=${fx.branchB}`))).toEqual([]);
        expect(ids(await api(r.actor ?? 'restrictedA').get(`${r.base()}?limit=100&patientId=${fx.patients.B}`))).toEqual([]);
      });
      it('owner and multi-branch user see both branches', async () => {
        expect(ids(await api('owner').get(`${r.base()}?limit=100`))).toEqual(expect.arrayContaining([rec('A'), rec('B')]));
        expect(ids(await api('multiAB').get(`${r.base()}?limit=100`))).toEqual(expect.arrayContaining([rec('A'), rec('B')]));
      });
      it('unassigned user sees none of them', async () => {
        const list = ids(await api('unassigned').get(`${r.base()}?limit=100`));
        expect(list).not.toContain(rec('A'));
        expect(list).not.toContain(rec('B'));
      });
      if (r.detail) {
        it('restricted user: Branch B record by id → 404 (read, update, delete); row survives', async () => {
          const who = r.actor ?? 'restrictedA';
          expect((await api(who).get(`${r.base()}/${rec('B')}`)).status).toBe(404);
          expect((await api(who).patch(`${r.base()}/${rec('B')}`, r.patch!('B'))).status).toBe(404);
          expect((await api(who).delete(`${r.base()}/${rec('B')}`)).status).toBe(404);
          const [row] = await ds.query(`SELECT deleted_at FROM ${TABLE[r.key]} WHERE id = $1`, [rec('B')]);
          expect(row.deleted_at).toBeNull();
        });
        it('restricted user can read their own branch record', async () => {
          expect((await api(r.actor ?? 'restrictedA').get(`${r.base()}/${rec('A')}`)).status).toBe(200);
        });
      } else {
        it('restricted user: delete Branch B record by id → 404; row survives', async () => {
          expect((await api('restrictedA').delete(`${r.base()}/${rec('B')}`)).status).toBe(404);
          const [row] = await ds.query(`SELECT deleted_at FROM ${TABLE[r.key]} WHERE id = $1`, [rec('B')]);
          expect(row.deleted_at).toBeNull();
        });
      }
      it("[G11] restricted user cannot create against Branch B's (or a NULL-branch) patient", async () => {
        expect((await api(r.actor ?? 'restrictedA').post(r.base(), r.create(fx.patients.B))).status).toBe(404);
        expect((await api(r.actor ?? 'restrictedA').post(r.base(), r.create(fx.patients.NULL))).status).toBe(404);
      });
      it('restricted user can create against their own branch patient', async () => {
        const res = await api(r.actor ?? 'restrictedA').post(r.base(), r.create(fx.patients.A));
        if (res.body?.id) createdLinked.push({ table: TABLE[r.key], id: res.body.id });
        expect(res.status).toBe(201);
      });
    });
  }

  describe('patient documents (G13)', () => {
    const base = () => `/organisations/${fx.orgId}/documents`;
    const doc = (side: Side) => fx.records.document[side];
    it("restricted user: list excludes Branch B's patient documents", async () => {
      const list = ids(await api('restrictedA').get(`${base()}?limit=100`));
      expect(list).toContain(doc('A'));
      expect(list).not.toContain(doc('B'));
    });
    it('restricted user: Branch B document by id / by patient → 404; delete refused', async () => {
      expect((await api('restrictedA').get(`${base()}/${doc('B')}`)).status).toBe(404);
      expect((await api('restrictedA').get(`${base()}/related/patient/${fx.patients.B}`)).status).toBe(404);
      expect((await api('restrictedA').patch(`${base()}/${doc('B')}`, { name: 'ZZBF-B' })).status).toBe(404);
      expect((await api('restrictedA').delete(`${base()}/${doc('B')}`)).status).toBe(404);
      const [row] = await ds.query(`SELECT deleted_at FROM documents WHERE id = $1`, [doc('B')]);
      expect(row.deleted_at).toBeNull();
    });
    it("restricted user cannot attach a document to Branch B's patient", async () => {
      const res = await api('restrictedA').post(base(), {
        relatedType: 'patient', relatedId: fx.patients.B, name: `ZZRun-${RUN}`, fileName: 'x.pdf', filePath: 'x/x.pdf',
      });
      if (res.body?.id) createdLinked.push({ table: 'documents', id: res.body.id });
      expect(res.status).toBe(404);
    });
    it('owner sees both', async () => {
      expect(ids(await api('owner').get(`${base()}?limit=100`))).toEqual(expect.arrayContaining([doc('A'), doc('B')]));
    });
  });
  // ── Stays & money (Phase 3: G2, G3, G6 + list/read on the shared rule) ────
  describe('bookings (G2)', () => {
    const bk = (side: Side) => fx.stays.booking[side];
    it('restricted list / calendar: own branch only; switcher cannot widen', async () => {
      const own = ids(await api('restrictedA').get('/retreat/bookings'));
      expect(own).toContain(bk('A'));
      expect(own).not.toContain(bk('B'));
      expect(ids(await api('restrictedA').get(`/retreat/bookings?branchId=${fx.branchB}`))).toEqual([]);
      const cal = await api('restrictedA').get('/retreat/bookings/calendar?startDate=2029-01-01&endDate=2029-01-03');
      expect((cal.body.bookings ?? []).map((b: any) => b.id)).not.toContain(bk('B'));
    });
    it('owner sees both', async () => {
      expect(ids(await api('owner').get('/retreat/bookings'))).toEqual(expect.arrayContaining([bk('A'), bk('B')]));
    });
    it('restricted user: every action on a Branch B booking → 404, booking unchanged', async () => {
      const u = api('restrictedA');
      const id = bk('B');
      const before = (await ds.query(`SELECT status, total_price, deleted_at FROM room_bookings WHERE id = $1`, [id]))[0];
      expect((await u.get(`/retreat/bookings/${id}`)).status).toBe(404);
      expect((await u.patch(`/retreat/bookings/${id}`, { totalPrice: 1000 })).status).toBe(404);
      expect((await u.delete(`/retreat/bookings/${id}`)).status).toBe(404);
      expect((await u.delete(`/retreat/bookings/${id}/remove`)).status).toBe(404);
      expect((await u.get(`/retreat/bookings/${id}/advances`)).status).toBe(404);
      expect((await u.post(`/retreat/bookings/${id}/advances`, { amount: 1, paymentMethod: 'cash' })).status).toBe(404);
      expect((await u.delete(`/retreat/bookings/${id}/advances/00000000-0000-4000-8000-000000000000`)).status).toBe(404);
      expect((await u.patch(`/retreat/bookings/${id}/refund`, { amount: 1, method: 'CASH' })).status).toBe(404);
      expect((await u.post(`/retreat/bookings/${id}/promote`, {})).status).toBe(404);
      const after = (await ds.query(`SELECT status, total_price, deleted_at FROM room_bookings WHERE id = $1`, [id]))[0];
      expect(after).toEqual(before);
    });
    it('restricted user can read their own branch booking', async () => {
      expect((await api('restrictedA').get(`/retreat/bookings/${bk('A')}`)).status).toBe(200);
    });
  });

  describe('admissions (G3)', () => {
    const adm = (side: Side) => fx.stays.admission[side];
    it('restricted list: own branch only', async () => {
      const own = ids(await api('restrictedA').get('/retreat/admissions'));
      expect(own).toContain(adm('A'));
      expect(own).not.toContain(adm('B'));
      expect(ids(await api('restrictedA').get(`/retreat/admissions?branchId=${fx.branchB}`))).toEqual([]);
    });
    it('restricted user: read / discharge / record delivery on Branch B → 404, admission unchanged', async () => {
      const u = api('restrictedA');
      expect((await u.get(`/retreat/admissions/${adm('B')}`)).status).toBe(404);
      expect((await u.post(`/retreat/admissions/${adm('B')}/discharge`, {})).status).toBe(404);
      expect((await u.patch(`/retreat/admissions/${adm('B')}/delivery`, { actualDeliveryDate: '2029-01-02' })).status).toBe(404);
      const [row] = await ds.query(`SELECT status, actual_delivery_date FROM admissions WHERE id = $1`, [adm('B')]);
      expect(row.status).toBe('ACTIVE');
      expect(row.actual_delivery_date).toBeNull();
    });
    it('owner and multi-branch user see both', async () => {
      expect(ids(await api('owner').get('/retreat/admissions'))).toEqual(expect.arrayContaining([adm('A'), adm('B')]));
      expect(ids(await api('multiAB').get('/retreat/admissions'))).toEqual(expect.arrayContaining([adm('A'), adm('B')]));
    });
  });

  describe('patient bills (G6, G11)', () => {
    const bill = (side: Side) => fx.stays.bill[side];
    it('restricted list: own branch only', async () => {
      const own = ids(await api('restrictedA').get('/patient-billing?limit=100'));
      expect(own).toContain(bill('A'));
      expect(own).not.toContain(bill('B'));
      expect(ids(await api('restrictedA').get(`/patient-billing?limit=100&branchId=${fx.branchB}`))).toEqual([]);
    });
    it('restricted user: read / edit / pay / payments / delete on Branch B → 404, bill unchanged', async () => {
      const u = api('restrictedA');
      const before = (await ds.query(`SELECT status, total, paid_amount, deleted_at FROM patient_bills WHERE id = $1`, [bill('B')]))[0];
      expect((await u.get(`/patient-billing/${bill('B')}`)).status).toBe(404);
      expect((await u.patch(`/patient-billing/${bill('B')}`, { notes: 'ZZBF-B' })).status).toBe(404);
      expect((await u.post(`/patient-billing/${bill('B')}/payment`, { amount: 1, paymentMethod: 'cash' })).status).toBe(404);
      expect((await u.get(`/patient-billing/${bill('B')}/payments`)).status).toBe(404);
      expect((await u.delete(`/patient-billing/${bill('B')}`)).status).toBe(404);
      const after = (await ds.query(`SELECT status, total, paid_amount, deleted_at FROM patient_bills WHERE id = $1`, [bill('B')]))[0];
      expect(after).toEqual(before);
    });
    const newBill = (patientId: string) => ({
      patientId, billDate: '2026-09-24', branchId: fx.branchA,
      items: [{ itemType: 'consultation', itemName: `ZZRun-${RUN}`, unitPrice: 1 }],
    });
    it("[G11] restricted user cannot bill Branch B's (or a NULL-branch) patient", async () => {
      expect((await api('restrictedA').post('/patient-billing', newBill(fx.patients.B))).status).toBe(404);
      expect((await api('restrictedA').post('/patient-billing', newBill(fx.patients.NULL))).status).toBe(404);
    });
    it('restricted user can bill their own branch patient', async () => {
      const res = await api('restrictedA').post('/patient-billing', newBill(fx.patients.A));
      if (res.body?.id) createdLinked.push({ table: 'patient_bills', id: res.body.id });
      expect(res.status).toBe(201);
    });
  });
  // ── Phase 4: trusted write branch (G10) ───────────────────────────────────
  describe('write branch (G10)', () => {
    const runDay = (offset: number) => new Date(Date.UTC(2031, 0, 1) + ((Number(RUN) % 2000) * 3 + offset) * 86400000).toISOString().slice(0, 10);
    const count = async (sql: string, params: any[]) => (await ds.query(sql, params))[0].n as number;

    it('appointment: branch comes from the patient; a conflicting branchId → 400', async () => {
      const body = { patientId: fx.patients.A, doctorId: fx.doctorStaffId, appointmentDate: runDay(0), appointmentTime: '09:00' };
      expect((await api('restrictedA').post('/appointments', { ...body, branchId: fx.branchB })).status).toBe(400);
      const res = await api('restrictedA').post('/appointments', body);
      if (res.body?.id) createdLinked.push({ table: 'appointments', id: res.body.id });
      expect(res.status).toBe(201);
      expect(res.body.branchId).toBe(fx.branchA);
    });

    it("bill: walk-in in another branch → 403; patient + conflicting branch → 400; another branch's booking → 404", async () => {
      const item = [{ itemType: 'consultation', itemName: `ZZRun-${RUN}`, unitPrice: 1 }];
      const u = api('restrictedA');
      expect((await u.post('/patient-billing', { walkInName: `ZZRun-${RUN}`, billDate: '2026-09-24', items: item, branchId: fx.branchB })).status).toBe(403);
      expect((await u.post('/patient-billing', { patientId: fx.patients.A, billDate: '2026-09-24', items: item, branchId: fx.branchB })).status).toBe(400);
      expect((await u.post('/patient-billing', { patientId: fx.patients.A, bookingId: fx.stays.booking.B, billDate: '2026-09-24', items: item })).status).toBe(404);
      expect(await count(`SELECT count(*)::int n FROM patient_bills pb JOIN bill_items bi ON bi."billId" = pb.id WHERE pb.organisation_id = $1 AND bi."itemName" = $2 AND pb.branch_id = $3`,
        [fx.orgId, `ZZRun-${RUN}`, fx.branchB])).toBe(0);
    });

    it("booking create: another branch's room → 404; patient from another branch → 400; conflicting branchId → 400; nothing written", async () => {
      const base = { checkInDate: runDay(10), checkOutDate: runDay(12), totalPrice: 1 };
      expect((await api('restrictedA').post('/retreat/bookings', { ...base, patientId: fx.patients.A, roomId: fx.stays.freeRoom.B })).status).toBe(404);
      expect((await api('multiAB').post('/retreat/bookings', { ...base, patientId: fx.patients.A, roomId: fx.stays.freeRoom.B })).status).toBe(400);
      expect((await api('restrictedA').post('/retreat/bookings', { ...base, patientId: fx.patients.A, roomId: fx.stays.freeRoom.A, branchId: fx.branchB })).status).toBe(400);
      expect(await count(`SELECT count(*)::int n FROM room_bookings WHERE organisation_id = $1 AND check_in_date = $2 AND deleted_at IS NULL`, [fx.orgId, runDay(10)])).toBe(0);
    });

    it("booking create in own branch's room takes the room's branch; moving it to another branch's room → 404", async () => {
      const res = await api('restrictedA').post('/retreat/bookings', {
        checkInDate: runDay(20), checkOutDate: runDay(22), totalPrice: 1, patientId: fx.patients.A, roomId: fx.stays.freeRoom.A,
      });
      if (res.body?.id) createdLinked.push({ table: 'room_bookings', id: res.body.id });
      expect(res.status).toBe(201);
      expect(res.body.branchId).toBe(fx.branchA);
      expect((await api('restrictedA').patch(`/retreat/bookings/${res.body.id}`, { roomId: fx.stays.freeRoom.B })).status).toBe(404);
      expect((await api('restrictedA').patch(`/retreat/bookings/${res.body.id}`, { branchId: fx.branchB })).status).toBe(400);
      const [row] = await ds.query(`SELECT room_id, branch_id FROM room_bookings WHERE id = $1`, [res.body.id]);
      expect(row).toEqual({ room_id: fx.stays.freeRoom.A, branch_id: fx.branchA });
    });

    it("check-in: another branch's room → 404; patient from another branch → 400; no admission written", async () => {
      expect((await api('restrictedA').post('/retreat/admissions', { patientId: fx.patients.A, roomId: fx.stays.freeRoom.B })).status).toBe(404);
      expect((await api('multiAB').post('/retreat/admissions', { patientId: fx.patients.A, roomId: fx.stays.freeRoom.B })).status).toBe(400);
      expect(await count(`SELECT count(*)::int n FROM admissions WHERE room_id = $1 AND status = 'ACTIVE'`, [fx.stays.freeRoom.B])).toBe(0);
    });

    it("enquiry → booking: another branch's room → 404; own room → booking in that branch (used to be NULL)", async () => {
      const enq = await api('restrictedA').post('/retreat/enquiries', { contactName: `ZZRun-${RUN}`, phone: '9000000888', channel: 'PHONE' });
      expect(enq.status).toBe(201);
      createdLinked.push({ table: 'booking_enquiries', id: enq.body.id });
      const conv = (roomId: string, day: number) => api('restrictedA').post(`/retreat/enquiries/${enq.body.id}/convert`, {
        roomId, checkInDate: runDay(day), checkOutDate: runDay(day + 1), totalPrice: 1,
      });
      expect((await conv(fx.stays.freeRoom.B, 30)).status).toBe(404);
      const ok = await conv(fx.stays.freeRoom.A, 40);
      if (ok.body?.id) createdLinked.push({ table: 'room_bookings', id: ok.body.id });
      expect(ok.status).toBe(201);
      expect(ok.body.branchId).toBe(fx.branchA);
    });

    it("setup writes: create in another branch → 403; edit / delete another branch's room → 404, room unchanged", async () => {
      const u = api('restrictedA');
      expect((await u.post('/retreat/rooms', { roomNumber: `ZZRun-${RUN}`, branchId: fx.branchB })).status).toBe(403);
      expect((await u.post('/retreat/room-categories', { name: `ZZRun-${RUN}`, branchId: fx.branchB })).status).toBe(403);
      expect((await u.patch(`/retreat/rooms/${fx.stays.freeRoom.B}`, { floor: 'x' })).status).toBe(404);
      expect((await u.delete(`/retreat/rooms/${fx.stays.freeRoom.B}`)).status).toBe(404);
      const [room] = await ds.query(`SELECT floor, deleted_at FROM rooms WHERE id = $1`, [fx.stays.freeRoom.B]);
      expect(room).toEqual({ floor: null, deleted_at: null });
      expect(await count(`SELECT count(*)::int n FROM rooms WHERE organisation_id = $1 AND room_number = $2`, [fx.orgId, `ZZRun-${RUN}`])).toBe(0);
      expect((await u.post(`/organisations/${fx.orgId}/duty-types`, { name: `ZZRun-${RUN}`, startTime: '09:00:00', endTime: '17:00:00', branchId: fx.branchB })).status).toBe(403);
    });
  });
  // ── Phase 5: cash drawers (G7) + clinic analytics (G9) ────────────────────
  describe('cash drawers (G7)', () => {
    const drawer: Record<Side, string> = {} as any;
    beforeAll(async () => {
      await api('owner').post('/cash/go-live/seed', {}); // idempotent: one cash drawer per branch
      for (const side of ['A', 'B'] as Side[]) {
        const branch = side === 'A' ? fx.branchA : fx.branchB;
        const [row] = await ds.query(`SELECT id FROM accounts WHERE organisation_id = $1 AND system_key = $2`, [fx.orgId, `cash_drawer:${branch}`]);
        drawer[side] = row.id;
      }
    });
    const ledgers = async (role: Role, branchId?: string) =>
      ids(await api(role).get(`/cash/receiving-ledgers?paymentMethod=cash${branchId ? `&branchId=${branchId}` : ''}`));

    it("picker: restricted user never sees another branch's drawer, even when asking for that branch", async () => {
      const own = await ledgers('restrictedA');
      expect(own).toContain(drawer.A);
      expect(own).not.toContain(drawer.B);
      expect(await ledgers('restrictedA', fx.branchB)).not.toContain(drawer.B);
    });
    it('picker: multi-branch user sees both, narrowed by the record branch; unassigned sees neither', async () => {
      expect(await ledgers('multiAB')).toEqual(expect.arrayContaining([drawer.A, drawer.B]));
      const onlyA = await ledgers('multiAB', fx.branchA);
      expect(onlyA).toContain(drawer.A);
      expect(onlyA).not.toContain(drawer.B);
      const none = await ledgers('unassigned');
      expect(none).not.toContain(drawer.A);
      expect(none).not.toContain(drawer.B);
    });
    it('picker: owner sees both; the record branch narrows to that drawer', async () => {
      expect(await ledgers('owner')).toEqual(expect.arrayContaining([drawer.A, drawer.B]));
      expect(await ledgers('owner', fx.branchB)).not.toContain(drawer.A);
    });
    it("posting: a Branch-A bill can't be paid into Branch B's drawer (create + record payment); nothing written", async () => {
      const item = [{ itemType: 'consultation', itemName: `ZZCash-${RUN}`, unitPrice: 10 }];
      const bad = await api('restrictedA').post('/patient-billing', {
        patientId: fx.patients.A, billDate: '2026-09-24', items: item, paidAmount: 1, paymentMethod: 'cash', receivedIntoAccountId: drawer.B,
      });
      if (bad.body?.id) createdLinked.push({ table: 'patient_bills', id: bad.body.id });
      expect(bad.status).toBe(400);
      const before = (await ds.query(`SELECT paid_amount FROM patient_bills WHERE id = $1`, [fx.stays.bill.A]))[0];
      expect((await api('restrictedA').post(`/patient-billing/${fx.stays.bill.A}/payment`, { amount: 1, paymentMethod: 'cash', receivedIntoAccountId: drawer.B })).status).toBe(400);
      expect((await ds.query(`SELECT paid_amount FROM patient_bills WHERE id = $1`, [fx.stays.bill.A]))[0]).toEqual(before);
      const [{ n }] = await ds.query(`SELECT count(*)::int n FROM patient_bill_payments WHERE received_into_account_id = $1`, [drawer.B]);
      expect(n).toBe(0);
    });
    it("posting: a Branch-A bill paid into Branch A's drawer is accepted", async () => {
      const ok = await api('restrictedA').post('/patient-billing', {
        patientId: fx.patients.A, billDate: '2026-09-24', items: [{ itemType: 'consultation', itemName: `ZZCash-${RUN}`, unitPrice: 10 }],
        paidAmount: 1, paymentMethod: 'cash', receivedIntoAccountId: drawer.A,
      });
      if (ok.body?.id) createdLinked.push({ table: 'patient_bills', id: ok.body.id });
      expect(ok.status).toBe(201);
    });
  });

  // ── Phase 7: enquiries (G12) ──────────────────────────────────────────────
  describe('enquiries (G12)', () => {
    const enq = (k: 'A' | 'B' | 'NULL') => fx.enquiries[k];
    const day = (offset: number) => new Date(Date.UTC(2032, 0, 1) + ((Number(RUN) % 2000) * 3 + offset) * 86400000).toISOString().slice(0, 10);

    it('list: restricted sees own branch only (no Branch B, no NULL); switcher cannot widen', async () => {
      const own = ids(await api('restrictedA').get('/retreat/enquiries'));
      expect(own).toContain(enq('A'));
      expect(own).not.toContain(enq('B'));
      expect(own).not.toContain(enq('NULL'));
      expect(ids(await api('restrictedA').get(`/retreat/enquiries?branchId=${fx.branchB}`))).toEqual([]);
    });
    it('list: multi-branch sees A + B; owner also sees the NULL row; unassigned sees none', async () => {
      expect(ids(await api('multiAB').get('/retreat/enquiries'))).toEqual(expect.arrayContaining([enq('A'), enq('B')]));
      expect(ids(await api('owner').get('/retreat/enquiries'))).toEqual(expect.arrayContaining([enq('A'), enq('B'), enq('NULL')]));
      const none = ids(await api('unassigned').get('/retreat/enquiries'));
      expect(none).not.toContain(enq('A'));
      expect(none).not.toContain(enq('B'));
    });
    it("today's follow-ups: restricted user never sees Branch B's or NULL enquiries", async () => {
      const today = await api('restrictedA').get('/retreat/today');
      const follow = (today.body.followUps ?? []).map((e: any) => e.id);
      expect(follow).toContain(enq('A'));
      expect(follow).not.toContain(enq('B'));
      expect(follow).not.toContain(enq('NULL'));
    });
    it('actions on a Branch B (or NULL) enquiry → 404, enquiry unchanged', async () => {
      const u = api('restrictedA');
      for (const k of ['B', 'NULL'] as const) {
        const before = (await ds.query(`SELECT status, notes, lost_reason FROM booking_enquiries WHERE id = $1`, [enq(k)]))[0];
        expect((await u.patch(`/retreat/enquiries/${enq(k)}`, { notes: 'x' })).status).toBe(404);
        expect((await u.post(`/retreat/enquiries/${enq(k)}/lost`, { lostReason: 'x' })).status).toBe(404);
        expect((await u.post(`/retreat/enquiries/${enq(k)}/convert`, {
          roomId: fx.stays.freeRoom.A, checkInDate: day(0), checkOutDate: day(1), totalPrice: 1,
        })).status).toBe(404);
        expect((await ds.query(`SELECT status, notes, lost_reason FROM booking_enquiries WHERE id = $1`, [enq(k)]))[0]).toEqual(before);
      }
    });
    it("convert: the room must be in the enquiry's branch (A enquiry + B room → 404 / 400); no booking written", async () => {
      const body = { roomId: fx.stays.freeRoom.B, checkInDate: day(10), checkOutDate: day(11), totalPrice: 1 };
      expect((await api('restrictedA').post(`/retreat/enquiries/${enq('A')}/convert`, body)).status).toBe(404);
      expect((await api('multiAB').post(`/retreat/enquiries/${enq('A')}/convert`, body)).status).toBe(400);
      const [{ n }] = await ds.query(`SELECT count(*)::int n FROM room_bookings WHERE enquiry_id = $1 AND check_in_date = $2`, [enq('A'), day(10)]);
      expect(n).toBe(0);
    });
    it("booking from another branch's enquiry → 404", async () => {
      expect((await api('restrictedA').post('/retreat/bookings', {
        enquiryId: enq('B'), roomId: fx.stays.freeRoom.A, checkInDate: day(20), checkOutDate: day(21), totalPrice: 1,
      })).status).toBe(404);
    });
    it('create: forged branch → 403 (nothing written); no branch → own single branch; multi-branch without branch → 400', async () => {
      const name = `ZZEnq-${RUN}`;
      expect((await api('restrictedA').post('/retreat/enquiries', { contactName: name, phone: '9000000998', channel: 'PHONE', branchId: fx.branchB })).status).toBe(403);
      const [{ n }] = await ds.query(`SELECT count(*)::int n FROM booking_enquiries WHERE contact_name = $1`, [name]);
      expect(n).toBe(0);
      const ok = await api('restrictedA').post('/retreat/enquiries', { contactName: name, phone: '9000000998', channel: 'PHONE' });
      if (ok.body?.id) createdLinked.push({ table: 'booking_enquiries', id: ok.body.id });
      expect(ok.body.branchId).toBe(fx.branchA);
      expect((await api('multiAB').post('/retreat/enquiries', { contactName: name, phone: '9000000998', channel: 'PHONE' })).status).toBe(400);
    });
  });
  // ── Phase 8: switcher consistency (expenses, orders, invoices, POs, rooms) ─
  describe('switcher consistency (Phase 8)', () => {
    const P = () => fx.procurement;
    const listIds = async (role: Role, url: string) => ids(await api(role).get(url));

    it('expenses: restricted sees own branch only (no B, no NULL); owner sees all, switcher narrows', async () => {
      const own = await listIds('restrictedA', '/expenses?limit=100');
      expect(own).toContain(P().expense.A);
      expect(own).not.toContain(P().expense.B);
      expect(own).not.toContain(P().expense.NULL);
      expect(await listIds('restrictedA', `/expenses?limit=100&branchId=${fx.branchB}`)).toEqual([]);
      expect(await listIds('owner', '/expenses?limit=100')).toEqual(expect.arrayContaining([P().expense.A, P().expense.B, P().expense.NULL]));
      const onlyB = await listIds('owner', `/expenses?limit=100&branchId=${fx.branchB}`);
      expect(onlyB).toContain(P().expense.B);
      expect(onlyB).not.toContain(P().expense.A);
    });
    it('expenses: Branch B expense by id → 404; create in another branch → 403; no branch → own branch', async () => {
      expect((await api('restrictedA').get(`/expenses/${P().expense.B}`)).status).toBe(404);
      const base = { amount: 1, category: 'operations', description: `ZZRun-${RUN}`, date: '2026-09-24' };
      expect((await api('restrictedA').post('/expenses', { ...base, branchId: fx.branchB })).status).toBe(403);
      const ok = await api('restrictedA').post('/expenses', base);
      if (ok.body?.id) createdLinked.push({ table: 'expenses', id: ok.body.id });
      expect(ok.status).toBe(201);
      expect(ok.body.branchId).toBe(fx.branchA);
    });

    it('clinic orders: restricted sees own branch only; order B by id → 404; multi-branch narrows by switcher', async () => {
      const own = await listIds('restrictedA', '/orders?limit=100');
      expect(own).toContain(P().order.A);
      expect(own).not.toContain(P().order.B);
      expect(own).not.toContain(P().order.NULL);
      expect(await listIds('restrictedA', `/orders?limit=100&branchId=${fx.branchB}`)).toEqual([]);
      expect((await api('restrictedA').get(`/orders/${P().order.B}`)).status).toBe(404);
      const onlyA = await listIds('multiAB', `/orders?limit=100&branchId=${fx.branchA}`);
      expect(onlyA).toContain(P().order.A);
      expect(onlyA).not.toContain(P().order.B);
      expect(await listIds('owner', '/orders?limit=100')).toEqual(expect.arrayContaining([P().order.A, P().order.B, P().order.NULL]));
    });

    it("invoices follow their order's branch — list, detail and the summary totals", async () => {
      const own = await listIds('restrictedA', '/invoices?limit=100');
      expect(own).toContain(P().invoice.A);
      expect(own).not.toContain(P().invoice.B);
      expect((await api('restrictedA').get(`/invoices/${P().invoice.B}`)).status).toBe(404);
      // Totals: restricted A's summary counts only Branch A's invoice; owner's counts both.
      const count = (b: any) => Number(b.pendingCount) + Number(b.paidCount) + Number(b.overdueCount);
      const a = (await api('restrictedA').get('/invoices/summary')).body;
      const all = (await api('owner').get('/invoices/summary')).body;
      const onlyB = (await api('owner').get(`/invoices/summary?branchId=${fx.branchB}`)).body;
      expect(count(a)).toBe(1);
      expect(count(all)).toBe(2);
      expect(count(onlyB)).toBe(1);
    });

    it('purchase orders: list and detail follow the branch scope', async () => {
      const base = `/organisations/${fx.orgId}/purchase-orders`;
      const own = await listIds('restrictedA', base);
      expect(own).toContain(P().po.A);
      expect(own).not.toContain(P().po.B);
      expect(await listIds('restrictedA', `${base}?branchId=${fx.branchB}`)).toEqual([]);
      expect((await api('restrictedA').get(`${base}/${P().po.B}`)).status).toBe(404);
      expect(await listIds('owner', base)).toEqual(expect.arrayContaining([P().po.A, P().po.B]));
    });

    it("rooms picker: restricted never gets another branch's rooms; owner's switcher narrows", async () => {
      const own = await listIds('restrictedA', '/retreat/rooms');
      expect(own).toContain(fx.stays.room.A);
      expect(own).not.toContain(fx.stays.room.B);
      const avail = await listIds('restrictedA', `/retreat/rooms/available?checkInDate=2033-01-01&checkOutDate=2033-01-02&branchId=${fx.branchB}`);
      expect(avail).not.toContain(fx.stays.freeRoom.B);
      const ownerB = await listIds('owner', `/retreat/rooms?branchId=${fx.branchB}`);
      expect(ownerB).toContain(fx.stays.room.B);
      expect(ownerB).not.toContain(fx.stays.room.A);
      expect((await api('restrictedA').post('/retreat/bookings/check-availability', {
        roomId: fx.stays.freeRoom.B, checkInDate: '2033-01-01', checkOutDate: '2033-01-02',
      })).status).toBe(404);
    });

    it("dashboard tiles: today's appointments follow the switcher (counts)", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const created: string[] = [];
      for (const side of ['A', 'B'] as Side[]) {
        const [row] = await ds.query(
          `INSERT INTO appointments (organisation_id, notes, patient_id, doctor_id, appointment_date, appointment_time, branch_id)
           VALUES ($1, $2, $3, $4, $5, '23:59', $6) RETURNING id`,
          [fx.orgId, `ZZRun-${RUN}`, fx.patients[side], fx.doctorStaffId, today, side === 'A' ? fx.branchA : fx.branchB]);
        created.push(row.id);
        createdLinked.push({ table: 'appointments', id: row.id });
      }
      const n = async (role: Role, q: string) => ids(await api(role).get(`/appointments?appointmentDate=${today}&limit=100${q}`)).filter((id) => created.includes(id)).length;
      expect(await n('owner', '')).toBe(2);
      expect(await n('owner', `&branchId=${fx.branchA}`)).toBe(1);
      expect(await n('restrictedA', '')).toBe(1);
      expect(await n('restrictedA', `&branchId=${fx.branchB}`)).toBe(0);
    });
  });
  // ── Phase 9: branch-scoped clinic analytics — totals vs direct DB aggregation ─
  describe('clinic analytics totals (Phase 9)', () => {
    type Set_ = 'ALL' | ('A' | 'B')[];
    const VARIANTS: { role: Role; branch?: 'A' | 'B'; expect: Set_ }[] = [
      { role: 'restrictedA', expect: ['A'] },
      { role: 'restrictedA', branch: 'B', expect: [] },      // can't obtain B
      { role: 'multiAB', expect: ['A', 'B'] },
      { role: 'multiAB', branch: 'A', expect: ['A'] },
      { role: 'multiAB', branch: 'B', expect: ['B'] },
      { role: 'owner', expect: 'ALL' },                       // incl. NULL-branch rows
      { role: 'owner', branch: 'B', expect: ['B'] },
      { role: 'unassigned', expect: [] },                     // nothing branch-scoped
    ];
    const branchIdOf = (b: 'A' | 'B') => (b === 'A' ? fx.branchA : fx.branchB);
    // Independent SQL (not the implementation's): WHERE org AND <branch set>.
    const agg = async (sql: string, col: string, set: Set_): Promise<number> => {
      const params: any[] = [fx.orgId];
      let where = '';
      if (set !== 'ALL') {
        params.push(set.map(branchIdOf));
        where = ` AND ${col} = ANY($2::uuid[])`;
      }
      const [row] = await ds.query(sql.replace('/*BRANCH*/', where), params);
      return Number(Object.values(row)[0] ?? 0);
    };
    const url = (path: string, b?: 'A' | 'B') => `${path}${b ? `?branchId=${branchIdOf(b)}` : ''}`;

    for (const v of VARIANTS) {
      const label = `${v.role}${v.branch ? ` + switcher ${v.branch}` : ''} → ${v.expect === 'ALL' ? 'all branches' : `[${v.expect.join(',')}]`}`;

      it(`clinic dashboard: ${label}`, async () => {
        const res = await api(v.role).get(url('/analytics/clinic', v.branch));
        expect(res.status).toBe(200);
        expect(res.body.totalPatients).toBe(await agg(`SELECT count(*) FROM patients WHERE organisation_id = $1 AND deleted_at IS NULL /*BRANCH*/`, 'branch_id', v.expect));
        expect(res.body.totalAppointments).toBe(await agg(`SELECT count(*) FROM appointments WHERE organisation_id = $1 AND deleted_at IS NULL /*BRANCH*/`, 'branch_id', v.expect));
        expect(res.body.totalRevenue).toBe(await agg(`SELECT COALESCE(SUM(paid_amount),0) FROM patient_bills WHERE organisation_id = $1 AND deleted_at IS NULL AND status IN ('paid','partial') /*BRANCH*/`, 'branch_id', v.expect));
        expect(res.body.totalExpenses).toBe(await agg(`SELECT COALESCE(SUM(amount),0) FROM expenses WHERE organisation_id = $1 AND deleted_at IS NULL /*BRANCH*/`, 'branch_id', v.expect));
      });

      it(`procurement + spend summary: ${label}`, async () => {
        const on = await agg(`SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE organisation_id = $1 AND deleted_at IS NULL AND status NOT IN ('cancelled','returned') /*BRANCH*/`, 'branch_id', v.expect);
        const off = await agg(`SELECT COALESCE(SUM(total_amount),0) FROM purchase_orders WHERE organisation_id = $1 AND deleted_at IS NULL AND status NOT IN ('draft','cancelled') /*BRANCH*/`, 'branch_id', v.expect);
        const proc = await api(v.role).get(url('/analytics/procurement', v.branch));
        expect(proc.status).toBe(200);
        expect(proc.body.onPlatformSpend).toBe(on);
        expect(proc.body.offPlatformSpend).toBe(off);
        const spend = await api(v.role).get(url('/analytics/spend-summary', v.branch));
        expect(spend.body.purchasesTotal).toBe(off);
        expect(spend.body.expensesTotal).toBe(await agg(`SELECT COALESCE(SUM(amount),0) FROM expenses WHERE organisation_id = $1 AND deleted_at IS NULL /*BRANCH*/`, 'branch_id', v.expect));
      });

      it(`inventory health + supplier performance + occupancy: ${label}`, async () => {
        const inv = await api(v.role).get(url('/analytics/inventory-health', v.branch));
        expect(inv.status).toBe(200);
        const stockFrom = `FROM inventory_branch_stock bs JOIN inventory_item_masters im ON im.id = bs.item_master_id AND im.deleted_at IS NULL WHERE bs.organisation_id = $1 AND bs.deleted_at IS NULL /*BRANCH*/`;
        expect(inv.body.summary.items).toBe(await agg(`SELECT count(*) ${stockFrom}`, 'bs.branch_id', v.expect));
        expect(inv.body.summary.lowStock).toBe(await agg(`SELECT count(*) FILTER (WHERE bs.current_stock <= bs.min_stock_level) ${stockFrom}`, 'bs.branch_id', v.expect));
        expect(inv.body.summary.stockValue).toBe(await agg(`SELECT COALESCE(SUM(bs.current_stock * COALESCE(im.cost_price, im.unit_price, 0)),0) ${stockFrom}`, 'bs.branch_id', v.expect));
        const sup = await api(v.role).get(url('/analytics/supplier-performance', v.branch));
        const received = (sup.body.leadTimeBySupplier ?? []).reduce((n: number, r: any) => n + r.receivedPos, 0);
        expect(received).toBe(await agg(`SELECT count(*) FROM purchase_orders WHERE organisation_id = $1 AND deleted_at IS NULL AND status = 'received' AND received_at IS NOT NULL /*BRANCH*/`, 'branch_id', v.expect));
        const occ = await api(v.role).get(url('/analytics/postnatal-occupancy', v.branch));
        expect(occ.body.activeAdmissions).toBe(await agg(`SELECT count(*) FROM admissions WHERE organisation_id = $1 AND deleted_at IS NULL AND status = 'ACTIVE' /*BRANCH*/`, 'branch_id', v.expect));
        expect(occ.body.totalRooms).toBe(await agg(`SELECT count(*) FROM rooms WHERE organisation_id = $1 AND deleted_at IS NULL AND is_active = true /*BRANCH*/`, 'branch_id', v.expect));
      });
    }

    it('a branch with no activity aggregates to exactly zero (not the org total, not another branch)', async () => {
      const a = (await api('owner').get(url('/analytics/clinic', 'A'))).body;
      const b = (await api('owner').get(url('/analytics/clinic', 'B'))).body;
      expect(a.totalRevenue).toBeGreaterThan(0);
      expect(b.totalRevenue).toBe(0);
      expect(b.revenueByMonth).toEqual([]);
      const pa = (await api('owner').get(url('/analytics/procurement', 'A'))).body;
      const pb = (await api('owner').get(url('/analytics/procurement', 'B'))).body;
      expect(pa.offPlatformSpend).toBeGreaterThan(0);
      expect(pb.offPlatformSpend).toBe(0);
      expect(pb.bySupplier).toEqual([]);
    });

    it('date filters are bound parameters (a quote in startDate is not SQL)', async () => {
      const res = await api('owner').get(`/analytics/clinic?startDate=${encodeURIComponent("2026-01-01' OR '1'='1")}`);
      expect(res.status).not.toBe(200); // rejected as a bad date, not executed as SQL
    });
  });
  // ── Pre-deploy review findings (R1, R2, R4) ───────────────────────────────
  describe('pre-deploy review regressions', () => {
    it('R1: a NULL-branch appointment is not in a restricted user\'s appointment list (Q1)', async () => {
      const [row] = await ds.query(
        `INSERT INTO appointments (organisation_id, notes, patient_id, doctor_id, appointment_date, appointment_time, branch_id)
         VALUES ($1, $2, $3, $4, '2034-01-01', '09:00', NULL) RETURNING id`,
        [fx.orgId, `ZZRun-${RUN}`, fx.patients.NULL, fx.doctorStaffId]);
      createdLinked.push({ table: 'appointments', id: row.id });
      expect(ids(await api('restrictedA').get('/appointments?limit=100'))).not.toContain(row.id);
      expect(ids(await api('owner').get('/appointments?limit=100'))).toContain(row.id);
    });

    it('R2: a bill\'s branch cannot be nulled (multi-branch → 400, single-branch → stays in its branch)', async () => {
      const bill = fx.stays.bill.A;
      expect((await api('multiAB').patch(`/patient-billing/${bill}`, { branchId: null })).status).toBe(400);
      await api('restrictedA').patch(`/patient-billing/${bill}`, { branchId: null });
      const [row] = await ds.query(`SELECT branch_id FROM patient_bills WHERE id = $1`, [bill]);
      expect(row.branch_id).toBe(fx.branchA);
    });

    it('R4: branch-restricted staff cannot change branch assignments (their own or anyone\'s)', async () => {
      const [staff] = await ds.query(`SELECT id FROM staff WHERE user_id = $1 AND organisation_id = $2`, [fx.userIds.restrictedA, fx.orgId]);
      const before = await ds.query(`SELECT count(*)::int n FROM staff_branch_assignments WHERE staff_id = $1 AND is_active AND deleted_at IS NULL`, [staff.id]);
      const res = await api('restrictedA').post(`/organisations/${fx.orgId}/staff-branch-assignments`, { staffId: staff.id, branchId: fx.branchB });
      if (res.body?.id) await ds.query(`UPDATE staff_branch_assignments SET is_active = false, deleted_at = now() WHERE id = $1`, [res.body.id]);
      expect(res.status).toBe(403);
      const after = await ds.query(`SELECT count(*)::int n FROM staff_branch_assignments WHERE staff_id = $1 AND is_active AND deleted_at IS NULL`, [staff.id]);
      expect(after).toEqual(before);
      expect(await api('restrictedA').get(`/organisations/${fx.orgId}/branches/switchable`).then((r) => ids(r))).toEqual([fx.branchA]);
    });
  });
});
