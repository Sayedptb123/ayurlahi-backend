import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * `createdAfter`/`createdBefore` must be full ISO 8601 UTC datetimes
 * ending in `Z` (e.g. `2026-09-01T00:00:00.000Z`). A bare date
 * (`"2026-09-01"`) parses as UTC midnight per spec, but a datetime with no
 * offset (`"2026-09-01T14:30:00"`) parses as the *server's local time* --
 * an inconsistency real enough to reject outright rather than rely on
 * callers to know. See "Boundary semantics" in
 * scope/Audit_Trail_ReadAPI_AdminUI_Implementation_Plan.md.
 */
const STRICT_UTC_ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const ISO_UTC_MESSAGE =
  'must be a full ISO 8601 UTC datetime ending in Z, e.g. 2026-09-01T00:00:00.000Z';

export class QueryAuditLogsDto {
  @IsOptional()
  @Matches(STRICT_UTC_ISO_8601, { message: `createdAfter ${ISO_UTC_MESSAGE}` })
  createdAfter?: string;

  @IsOptional()
  @Matches(STRICT_UTC_ISO_8601, { message: `createdBefore ${ISO_UTC_MESSAGE}` })
  createdBefore?: string;

  @IsOptional()
  @IsUUID()
  organisationId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsIn(['normal', 'sensitive', 'critical'])
  severity?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
