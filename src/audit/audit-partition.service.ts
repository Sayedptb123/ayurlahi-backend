import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

// Months of audit_logs partitions to keep ready beyond the current month.
export const AUDIT_PARTITION_MONTHS_AHEAD = 3;

// audit_logs is partitioned by month and has no default partition, so an
// insert for a month without a partition fails -- and login awaits its audit
// insert. This keeps partitions ready ahead of time by calling the idempotent
// ensure_audit_log_partitions() from 2026-09-24-audit-logs-partitions.sql,
// at startup and daily. Failures are logged, never thrown: a missed run is
// covered by the next one and by the months already created ahead.
@Injectable()
export class AuditPartitionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuditPartitionService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensurePartitions();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async ensurePartitions(): Promise<number | null> {
    try {
      const [row] = await this.dataSource.query(
        `SELECT ensure_audit_log_partitions(
           (date_trunc('month', now() AT TIME ZONE 'UTC') + ($1 || ' months')::interval)::date
         ) AS created`,
        [AUDIT_PARTITION_MONTHS_AHEAD],
      );
      const created = Number(row?.created ?? 0);
      if (created > 0) {
        this.logger.log(`Created ${created} audit_logs partition(s)`);
      }
      return created;
    } catch (err) {
      this.logger.error(
        `Could not ensure audit_logs partitions: ${(err as Error)?.message}`,
      );
      return null;
    }
  }
}
