import { businessDate, DEFAULT_TIMEZONE, getOrganisationTimezone, isValidTimeZone } from './business-date';

// Instants are given in UTC ('Z') so the result can't depend on the machine's
// own timezone. IST = UTC+05:30, so IST midnight is 18:30Z the day before.
describe('businessDate', () => {
  it.each([
    ['23:59 IST, 24 Sep', '2026-09-24T18:29:00Z', '2026-09-24'],
    ['00:01 IST, 25 Sep', '2026-09-24T18:31:00Z', '2026-09-25'],
    ['05:29 IST, 25 Sep', '2026-09-24T23:59:00Z', '2026-09-25'],
    ['05:30 IST, 25 Sep', '2026-09-25T00:00:00Z', '2026-09-25'],
    ['exactly IST midnight', '2026-09-24T18:30:00Z', '2026-09-25'],
  ])('%s → %s', (_label, instant, expected) => {
    expect(businessDate('Asia/Kolkata', new Date(instant))).toBe(expected);
  });

  it('differs from the UTC date in the 00:00–05:30 IST window (the G9 bug)', () => {
    const at = new Date('2026-09-23T19:58:00Z'); // 01:28 IST on 24 Sep — the live test that recorded 23 Sep
    expect(at.toISOString().slice(0, 10)).toBe('2026-09-23');
    expect(businessDate('Asia/Kolkata', at)).toBe('2026-09-24');
  });

  it('uses the given timezone, not India, when the organisation is elsewhere', () => {
    const at = new Date('2026-09-25T02:00:00Z');
    expect(businessDate('America/New_York', at)).toBe('2026-09-24');
    expect(businessDate('Asia/Dubai', at)).toBe('2026-09-25');
  });

  it.each([undefined, null, '', 'Not/AZone'])('falls back to Asia/Kolkata for %p', (tz) => {
    expect(businessDate(tz as any, new Date('2026-09-24T18:31:00Z'))).toBe('2026-09-25');
  });

  it('crosses month and year ends in the organisation timezone', () => {
    expect(businessDate('Asia/Kolkata', new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
    expect(businessDate('Asia/Kolkata', new Date('2027-02-28T18:30:00Z'))).toBe('2027-03-01');
  });

  it('validates IANA names', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('IST+5')).toBe(false);
  });
});

describe('getOrganisationTimezone', () => {
  it('reads organisation_settings.timezone', async () => {
    const manager: any = { query: jest.fn(() => Promise.resolve([{ timezone: 'Asia/Dubai' }])) };
    await expect(getOrganisationTimezone(manager, 'org-1')).resolves.toBe('Asia/Dubai');
    expect(manager.query.mock.calls[0][1]).toEqual(['org-1']);
  });

  it('defaults when the settings row is missing', async () => {
    const manager: any = { query: jest.fn(() => Promise.resolve([])) };
    await expect(getOrganisationTimezone(manager, 'org-1')).resolves.toBe(DEFAULT_TIMEZONE);
  });
});
