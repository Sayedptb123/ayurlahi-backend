import { EntityManager } from 'typeorm';

// The one place a business date ("today" for an organisation) is computed.
// A business date is the calendar day in the organisation's timezone, never the
// UTC day and never the server's local day: between 00:00 and 05:30 IST the UTC
// date is still yesterday. See scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md §2 G9.
// The app has the same logic in Medilink/src/lib/businessDate.ts; keep them in step.

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// 'YYYY-MM-DD' for the given instant (default: now) in the given timezone.
// An unknown or empty timezone falls back to DEFAULT_TIMEZONE.
export function businessDate(timeZone?: string | null, now: Date = new Date()): string {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// The organisation's timezone from organisation_settings (DEFAULT_TIMEZONE when
// the row is missing). Takes an EntityManager so callers inside a transaction
// read through it.
export async function getOrganisationTimezone(
  manager: EntityManager,
  organisationId: string,
): Promise<string> {
  const [row] = await manager.query(
    'SELECT timezone FROM organisation_settings WHERE organisation_id = $1',
    [organisationId],
  );
  return row?.timezone || DEFAULT_TIMEZONE;
}

export async function organisationBusinessDate(
  manager: EntityManager,
  organisationId: string,
  now: Date = new Date(),
): Promise<string> {
  return businessDate(await getOrganisationTimezone(manager, organisationId), now);
}

// How far the given timezone is ahead of UTC at the given instant, in ms.
function timeZoneOffsetMs(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallClockAsUtc - (at - (at % 1000));
}

// The last millisecond of business date 'YYYY-MM-DD' in the given timezone, as
// an instant. An unknown or empty timezone falls back to DEFAULT_TIMEZONE.
export function endOfBusinessDay(date: string, timeZone?: string | null): Date {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const nextDayAsUtc = Date.UTC(y, m - 1, d + 1);
  // Second pass settles a DST change between the guess and the real midnight.
  let nextMidnight = nextDayAsUtc - timeZoneOffsetMs(tz, nextDayAsUtc);
  nextMidnight = nextDayAsUtc - timeZoneOffsetMs(tz, nextMidnight);
  return new Date(nextMidnight - 1);
}
