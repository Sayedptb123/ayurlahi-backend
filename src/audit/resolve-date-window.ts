import { BadRequestException } from '@nestjs/common';
import { AUDIT_MAX_QUERY_WINDOW_DAYS } from './audit.constants';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

const MAX_WINDOW_MS = AUDIT_MAX_QUERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Derives a concrete [createdAfter, createdBefore) window from a query's
 * boundaries. Standalone (not a method on AuditReadService) so it can be
 * unit-tested directly without a mocked repository -- see "Boundary
 * semantics" in scope/Audit_Trail_ReadAPI_AdminUI_Implementation_Plan.md
 * for the full convention (createdAfter inclusive, createdBefore
 * exclusive; DTO-level @Matches already guarantees strict UTC ISO 8601
 * input by the time a string reaches here).
 */
export function resolveDateWindow(
  query: Pick<QueryAuditLogsDto, 'createdAfter' | 'createdBefore'>,
): { createdAfter: Date; createdBefore: Date } {
  if (!query.createdAfter && !query.createdBefore) {
    throw new BadRequestException(
      'At least one of createdAfter or createdBefore is required.',
    );
  }

  let after = query.createdAfter ? new Date(query.createdAfter) : undefined;
  let before = query.createdBefore ? new Date(query.createdBefore) : undefined;

  if (after && !before) {
    before = new Date(Math.min(Date.now(), after.getTime() + MAX_WINDOW_MS));
  } else if (before && !after) {
    after = new Date(before.getTime() - MAX_WINDOW_MS);
  }

  if (before!.getTime() - after!.getTime() > MAX_WINDOW_MS) {
    throw new BadRequestException(
      `Date range cannot exceed ${AUDIT_MAX_QUERY_WINDOW_DAYS} days.`,
    );
  }

  return { createdAfter: after!, createdBefore: before! };
}
