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

type Role = 'owner' | 'manager' | 'restrictedA' | 'multiAB' | 'unassigned';
const USERS: Record<Role, { role: string; staffBranches?: ('A' | 'B')[] }> = {
  owner: { role: 'OWNER' },
  manager: { role: 'MANAGER' },
  restrictedA: { role: 'RECEPTIONIST', staffBranches: ['A'] },
  multiAB: { role: 'NURSE', staffBranches: ['A', 'B'] },
  unassigned: { role: 'STAFF', staffBranches: [] },
};

interface Fixture {
  orgId: string;
  branchA: string;
  branchB: string;
  userIds: Record<Role, string>;
  patients: { A: string; B: string; NULL: string };
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
  let n = 0;
  for (const [key, spec] of Object.entries(USERS) as [Role, (typeof USERS)[Role]][]) {
    n++;
    const email = `zz-branch-fixture-${key.toLowerCase()}@example.invalid`;
    let user = await one(`SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]);
    if (!user) {
      user = await one(
        `INSERT INTO users (first_name, last_name, email, phone) VALUES ('ZZ Fixture', $1, $2, $3) RETURNING id`,
        [key, email, `+9900000${String(n).padStart(4, '0')}`],
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

  return { orgId, branchA, branchB, userIds, patients };
}

// Every request crosses to the staging DB (Mumbai); the 5 s default is too tight.
jest.setTimeout(30000);

describe('Branch isolation contract (real DB)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let fx: Fixture;
  const tokens = {} as Record<Role, string>;
  const createdPatientIds: string[] = [];

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
    test.failing('[Q1, Phase 2] restricted list hides NULL-branch patients', async () => {
      expect(ids(await api('restrictedA').get('/patients?limit=100'))).not.toContain(fx.patients.NULL);
    });
    test.failing('[Q1, Phase 2] unassigned user sees no patients at all', async () => {
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
    test.failing('[Q2, Phase 2] …and gets 404, not 403', async () => {
      expect((await api('restrictedA').get(`/patients/${fx.patients.B}`)).status).toBe(404);
    });

    // Sends the patient's own current lastName, so even a wrongly-accepted
    // update changes nothing.
    test.failing("[G4, Phase 2] restricted user cannot update another branch's patient", async () => {
      const res = await api('restrictedA').patch(`/patients/${fx.patients.B}`, { lastName: 'ZZBF-B' });
      expect(res.status).toBe(404);
    });

    it("restricted user cannot delete another branch's patient (row survives)", async () => {
      const res = await api('restrictedA').delete(`/patients/${fx.patients.B}`);
      expect(res.status).not.toBe(200);
      const [row] = await ds.query(`SELECT deleted_at FROM patients WHERE id = $1`, [fx.patients.B]);
      expect(row.deleted_at).toBeNull();
    });

    test.failing('[G10, Phase 4] restricted user cannot create a patient in another branch', async () => {
      const res = await api('restrictedA').post('/patients', { firstName: 'ZZForged', lastName: RUN, branchId: fx.branchB });
      if (res.body?.id) createdPatientIds.push(res.body.id);
      expect(res.status).toBe(403);
    });
    test.failing('[G10/Q3, Phase 4] create without branchId lands in the single usable branch', async () => {
      const res = await api('restrictedA').post('/patients', { firstName: 'ZZNoBranch', lastName: RUN });
      if (res.body?.id) createdPatientIds.push(res.body.id);
      expect(res.body?.branchId).toBe(fx.branchA);
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
    test.failing('[Q1, Phase 2] possible-matches hides NULL-branch patients from restricted users', async () => {
      expect(ids(await api('restrictedA').get(`/patients/possible-matches?phone=${SHARED_PHONE}`))).not.toContain(fx.patients.NULL);
    });
  });
});
