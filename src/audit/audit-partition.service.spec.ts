import { AuditPartitionService, AUDIT_PARTITION_MONTHS_AHEAD } from './audit-partition.service';

// F6: keeps audit_logs partitions ready ahead of time. See
// src/migrations/2026-09-24-audit-logs-partitions.sql.
describe('AuditPartitionService', () => {
  it('asks the database for partitions three months past the current month', async () => {
    const query = jest.fn(() => Promise.resolve([{ created: 0 }]));
    const service = new AuditPartitionService({ query } as any);
    await service.ensurePartitions();
    const [sql, params] = (query.mock.calls[0] as unknown) as [string, unknown[]];
    expect(sql).toContain('ensure_audit_log_partitions(');
    expect(sql).toContain("now() AT TIME ZONE 'UTC'");
    expect(params).toEqual([AUDIT_PARTITION_MONTHS_AHEAD]);
    expect(AUDIT_PARTITION_MONTHS_AHEAD).toBe(3);
  });

  it('returns how many partitions were created', async () => {
    const service = new AuditPartitionService({ query: () => Promise.resolve([{ created: '2' }]) } as any);
    await expect(service.ensurePartitions()).resolves.toBe(2);
  });

  it('never throws, so a failure cannot stop the app from starting', async () => {
    const service = new AuditPartitionService({ query: () => Promise.reject(new Error('db down')) } as any);
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    await expect(service.ensurePartitions()).resolves.toBeNull();
  });
});
