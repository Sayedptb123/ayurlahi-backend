import { CrmAuditService, normalizeCrmChanges } from './crm-audit.service';

// Phase 2 CRM migration -- see
// scope/Audit_Trail_Phase2_CRM_Migration_Implementation_Plan.md. Verifies
// the repoint of CrmAuditService onto the unified audit_logs table
// preserves CRM's existing behavior exactly, including the frontend
// contract (Medilink/src/types/crm.ts's CrmAuditEntry).

describe('normalizeCrmChanges — routing real CRM payload shapes', () => {
  it('routes a genuine before/after pair to changes as {field: {from, to}}', () => {
    const result = normalizeCrmChanges({
      before: { name: 'Old', priority: 'warm' },
      after: { name: 'New', priority: 'hot' },
    });
    expect(result.changes).toEqual({
      name: { from: 'Old', to: 'New' },
      priority: { from: 'warm', to: 'hot' },
    });
    expect(result.metadata).toBeNull();
  });

  it('routes a flat creation snapshot to metadata, not changes', () => {
    const result = normalizeCrmChanges({ name: 'Acme Clinic', source: 'referral' });
    expect(result.changes).toBeNull();
    expect(result.metadata).toEqual({ name: 'Acme Clinic', source: 'referral' });
  });

  it('routes a single-value update (no captured "from") to metadata', () => {
    const result = normalizeCrmChanges({ status: 'done' });
    expect(result.changes).toBeNull();
    expect(result.metadata).toEqual({ status: 'done' });
  });

  it('routes an event-fact object to metadata', () => {
    const result = normalizeCrmChanges({ event: 'check_in', distanceM: 12, locationMismatch: false });
    expect(result.changes).toBeNull();
    expect(result.metadata).toEqual({ event: 'check_in', distanceM: 12, locationMismatch: false });
  });

  it('routes undefined/null to both null', () => {
    expect(normalizeCrmChanges(undefined)).toEqual({ changes: null, metadata: null });
    expect(normalizeCrmChanges(null)).toEqual({ changes: null, metadata: null });
  });
});

const makeService = () => {
  const legacyRows: any[] = [];
  const newRows: any[] = [];
  const legacyAuditRepo: any = {
    find: jest.fn(() => Promise.resolve(legacyRows)),
  };
  const auditLogRepo: any = {
    find: jest.fn(() => Promise.resolve(newRows)),
  };
  const recordCalls: any[] = [];
  const auditService: any = {
    record: jest.fn((params: any) => {
      recordCalls.push(params);
      return Promise.resolve();
    }),
  };
  const service = new CrmAuditService(legacyAuditRepo, auditLogRepo, auditService);
  return { service, legacyRows, newRows, recordCalls, auditService };
};

describe('CrmAuditService.record — mapping onto AuditService', () => {
  it('maps a genuine-diff action (update) correctly', async () => {
    const { service, recordCalls } = makeService();
    await service.record({
      organisationId: 'org-1',
      entityType: 'lead',
      entityId: 'lead-1',
      action: 'update',
      actorUserId: 'u-1',
      actorRole: 'ADMIN',
      organisationType: 'AYURLAHI_TEAM',
      changes: { before: { name: 'Old' }, after: { name: 'New' } },
    });
    expect(recordCalls[0]).toMatchObject({
      organisationId: 'org-1',
      branchId: null,
      orgType: 'AYURLAHI_TEAM',
      entityType: 'lead',
      action: 'update',
      severity: 'normal',
      actorUserId: 'u-1',
      actorRole: 'ADMIN',
      source: 'api',
      changes: { name: { from: 'Old', to: 'New' } },
      metadata: null,
    });
  });

  it('translates delete to soft_delete and severity sensitive', async () => {
    const { service, recordCalls } = makeService();
    await service.record({
      organisationId: 'org-1', entityType: 'lead', entityId: 'lead-1',
      action: 'delete', actorUserId: 'u-1',
    });
    expect(recordCalls[0].action).toBe('soft_delete');
    expect(recordCalls[0].severity).toBe('sensitive');
  });

  it('merges stage metadata and a non-diff changes payload together (lost-stage case)', async () => {
    const { service, recordCalls } = makeService();
    await service.record({
      organisationId: 'org-1', entityType: 'lead', entityId: 'lead-1',
      action: 'stage_change', actorUserId: 'u-1',
      fromStage: 'negotiation', toStage: 'lost',
      changes: { lostReason: 'Chose a competitor' },
    });
    expect(recordCalls[0].changes).toBeNull();
    expect(recordCalls[0].metadata).toEqual({
      lostReason: 'Chose a competitor',
      fromStage: 'negotiation',
      toStage: 'lost',
    });
  });

  it('a metadata-only entity (visit) never populates changes', async () => {
    const { service, recordCalls } = makeService();
    await service.record({
      organisationId: 'org-1', entityType: 'visit', entityId: 'visit-1',
      action: 'update', actorUserId: 'u-1',
      changes: { event: 'check_in', distanceM: 5, locationMismatch: false },
    });
    expect(recordCalls[0].changes).toBeNull();
    expect(recordCalls[0].metadata).toEqual({ event: 'check_in', distanceM: 5, locationMismatch: false });
  });
});

describe('CrmAuditService.findForEntity — union read + frontend contract', () => {
  it('merges legacy and new-table rows, sorted newest first', async () => {
    const { service, legacyRows, newRows } = makeService();
    legacyRows.push({
      id: 'old-1', entityType: 'lead', entityId: 'lead-1', action: 'create',
      actorUserId: 'u-1', changes: { name: 'X' }, fromStage: null, toStage: null,
      createdAt: new Date('2026-01-01'),
    });
    newRows.push({
      id: 'new-1', entityType: 'lead', entityId: 'lead-1', action: 'soft_delete',
      actorUserId: 'u-2', changes: null, metadata: null,
      createdAt: new Date('2026-06-01'),
    });

    const result = await service.findForEntity('org-1', 'lead', 'lead-1');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('new-1'); // newest first
    expect(result[0].action).toBe('delete'); // projected back from soft_delete
    expect(result[1].id).toBe('old-1');
  });

  it('projects a diff-sourced new-table row correctly', async () => {
    const { service, newRows } = makeService();
    newRows.push({
      id: 'new-1', entityType: 'lead', entityId: 'lead-1', action: 'update',
      actorUserId: 'u-1', changes: { name: { from: 'Old', to: 'New' } }, metadata: null,
      createdAt: new Date('2026-06-01'),
    });
    const [row] = await service.findForEntity('org-1', 'lead', 'lead-1');
    expect(row).toEqual({
      id: 'new-1', entityType: 'lead', entityId: 'lead-1', action: 'update',
      actorUserId: 'u-1', changes: { name: { from: 'Old', to: 'New' } },
      fromStage: null, toStage: null, createdAt: new Date('2026-06-01'),
    });
  });

  it('projects a metadata-sourced new-table row correctly, including stage fields', async () => {
    const { service, newRows } = makeService();
    newRows.push({
      id: 'new-1', entityType: 'lead', entityId: 'lead-1', action: 'stage_change',
      actorUserId: 'u-1', changes: null,
      metadata: { lostReason: 'Chose a competitor', fromStage: 'negotiation', toStage: 'lost' },
      createdAt: new Date('2026-06-01'),
    });
    const [row] = await service.findForEntity('org-1', 'lead', 'lead-1');
    expect(row.changes).toEqual({ lostReason: 'Chose a competitor' });
    expect(row.fromStage).toBe('negotiation');
    expect(row.toStage).toBe('lost');
    // Exactly the CrmAuditEntry shape (Medilink/src/types/crm.ts) -- no
    // extra keys leak through from the new schema.
    expect(Object.keys(row).sort()).toEqual(
      ['action', 'actorUserId', 'changes', 'createdAt', 'entityId', 'entityType', 'fromStage', 'id', 'toStage'].sort(),
    );
  });
});
