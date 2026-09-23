import { NotFoundException } from '@nestjs/common';
import { Between } from 'typeorm';
import { AuditReadService } from './audit-read.service';

// Tests #7-10, #12, see
// scope/Audit_Trail_ReadAPI_AdminUI_Implementation_Plan.md "Tests". Real
// EXPLAIN/partition-pruning verification (test #13) happens against the
// live app, not here -- a mocked QueryBuilder can only prove what string
// was passed to .andWhere(), never what Postgres does with it.

const makeQueryBuilder = (result: { data: any[]; total: number }) => {
  const calls: { method: string; args: any[] }[] = [];
  const qb: any = {};
  const chain = (method: string) => (...args: any[]) => {
    calls.push({ method, args });
    return qb;
  };
  qb.select = chain('select');
  qb.where = chain('where');
  qb.andWhere = chain('andWhere');
  qb.orderBy = chain('orderBy');
  qb.skip = chain('skip');
  qb.take = chain('take');
  qb.getManyAndCount = jest.fn().mockResolvedValue([result.data, result.total]);
  return { qb, calls };
};

const makeService = (
  qb: any,
  findOneImpl?: any,
  opts?: { userFindOne?: any; orgFindOne?: any; branchFindOne?: any },
) => {
  const auditRepo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: findOneImpl ?? jest.fn(),
  };
  const userRepo = { findOne: opts?.userFindOne ?? jest.fn().mockResolvedValue(null) };
  const organisationRepo = { findOne: opts?.orgFindOne ?? jest.fn().mockResolvedValue(null) };
  const branchRepo = { findOne: opts?.branchFindOne ?? jest.fn().mockResolvedValue(null) };
  const service = new AuditReadService(
    auditRepo as any,
    userRepo as any,
    organisationRepo as any,
    branchRepo as any,
  );
  return { service, auditRepo, userRepo, organisationRepo, branchRepo };
};

const validWindow = {
  createdAfter: '2026-09-01T00:00:00.000Z',
  createdBefore: '2026-09-23T00:00:00.000Z',
};

describe('AuditReadService.findAll', () => {
  it('never selects changes/metadata (test #7)', async () => {
    const { qb, calls } = makeQueryBuilder({ data: [], total: 0 });
    const { service } = makeService(qb);

    await service.findAll(validWindow as any);

    const selectCall = calls.find((c) => c.method === 'select');
    const selectedFields: string[] = selectCall!.args[0];
    expect(selectedFields).not.toContain('audit.changes');
    expect(selectedFields).not.toContain('audit.metadata');
  });

  it('returns the exact { data, pagination } shape (test #8)', async () => {
    const rows = [{ id: '1' }, { id: '2' }];
    const { qb } = makeQueryBuilder({ data: rows, total: 42 });
    const { service } = makeService(qb);

    const result = await service.findAll({ ...validWindow, page: 2, limit: 10 } as any);

    expect(result).toEqual({
      data: rows,
      pagination: { page: 2, limit: 10, total: 42, totalPages: 5 },
    });
  });

  it.each([
    ['organisationId', 'organisationId', 'audit.organisationId = :organisationId'],
    ['branchId', 'branchId', 'audit.branchId = :branchId'],
    ['actorUserId', 'actorUserId', 'audit.actorUserId = :actorUserId'],
    ['action', 'action', 'audit.action = :action'],
    ['severity', 'severity', 'audit.severity = :severity'],
    ['entityType', 'entityType', 'audit.entityType = :entityType'],
    ['entityId', 'entityId', 'audit.entityId = :entityId'],
  ])('applies the %s filter as its own andWhere (test #12)', async (_label, field, expectedClause) => {
    const { qb, calls } = makeQueryBuilder({ data: [], total: 0 });
    const { service } = makeService(qb);

    await service.findAll({ ...validWindow, [field]: 'some-value' } as any);

    const match = calls.find(
      (c) => c.method === 'andWhere' && c.args[0] === expectedClause && c.args[1]?.[field] === 'some-value',
    );
    expect(match).toBeDefined();
  });
});

describe('AuditReadService.findOne', () => {
  it('returns the full row including changes/metadata for a correct id+createdAt pair (test #9)', async () => {
    const row = {
      id: 'a1',
      createdAt: new Date('2026-09-23T00:00:00.000Z'),
      changes: { x: { from: 1, to: 2 } },
      metadata: { y: 1 },
      actorUserId: null,
      organisationId: null,
      branchId: null,
    };
    const findOneImpl = jest.fn().mockResolvedValue(row);
    const { service } = makeService(null, findOneImpl);

    const result = await service.findOne('a1', '2026-09-23T00:00:00.000Z');

    expect(result.changes).toEqual({ x: { from: 1, to: 2 } });
    expect(result.metadata).toEqual({ y: 1 });
  });

  it('resolves actor/organisation/branch names for display, without querying an id that is null', async () => {
    const row = {
      id: 'a1',
      createdAt: new Date('2026-09-23T00:00:00.000Z'),
      actorUserId: 'u1',
      organisationId: 'org1',
      branchId: null,
    };
    const findOneImpl = jest.fn().mockResolvedValue(row);
    const userFindOne = jest.fn().mockResolvedValue({ id: 'u1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' });
    const orgFindOne = jest.fn().mockResolvedValue({ id: 'org1', name: 'CNS Ayurvedic Hospital' });
    const branchFindOne = jest.fn();
    const { service } = makeService(null, findOneImpl, { userFindOne, orgFindOne, branchFindOne });

    const result = await service.findOne('a1', '2026-09-23T00:00:00.000Z');

    expect(result.actorName).toBe('Jane Doe');
    expect(result.actorEmail).toBe('jane@example.com');
    expect(result.organisationName).toBe('CNS Ayurvedic Hospital');
    expect(result.branchName).toBeNull();
    expect(branchFindOne).not.toHaveBeenCalled(); // branchId is null on the row
  });

  it('resolves to null names (not a throw) when the referenced user no longer exists', async () => {
    const row = { id: 'a1', createdAt: new Date('2026-09-23T00:00:00.000Z'), actorUserId: 'deleted-user', organisationId: null, branchId: null };
    const findOneImpl = jest.fn().mockResolvedValue(row);
    const { service } = makeService(null, findOneImpl); // default mocks resolve null

    const result = await service.findOne('a1', '2026-09-23T00:00:00.000Z');

    expect(result.actorName).toBeNull();
    expect(result.actorEmail).toBeNull();
  });

  it('passes both id and a createdAt bound to the repository where clause, not id alone (test #10)', async () => {
    const findOneImpl = jest.fn().mockResolvedValue(null);
    const { service } = makeService(null, findOneImpl);

    await expect(service.findOne('a1', '2026-09-23T00:00:00.000Z')).rejects.toThrow(NotFoundException);

    // A 1ms Between range, not an exact `=` -- Postgres stores created_at
    // at microsecond precision but the client can only ever send back a
    // millisecond-truncated value (JS Date has no sub-millisecond
    // representation), so an exact match would never find the real row.
    // See the comment on AuditReadService.findOne for the real-DB finding
    // that drove this. The assertion that matters here is still that
    // createdAt constrains the query at all, not just id.
    const expectedLower = new Date('2026-09-23T00:00:00.000Z');
    const expectedUpper = new Date(expectedLower.getTime() + 1);
    expect(findOneImpl).toHaveBeenCalledWith({
      where: { id: 'a1', createdAt: Between(expectedLower, expectedUpper) },
    });
  });

  it('throws NotFoundException when no row matches', async () => {
    const findOneImpl = jest.fn().mockResolvedValue(null);
    const { service } = makeService(null, findOneImpl);

    await expect(service.findOne('missing', '2026-09-23T00:00:00.000Z')).rejects.toThrow(NotFoundException);
  });
});
