import { BadRequestException } from '@nestjs/common';
import { resolveDateWindow } from './resolve-date-window';

// Tests #4-6, see scope/Audit_Trail_ReadAPI_AdminUI_Implementation_Plan.md
// "Boundary semantics" -- the two worked examples there are asserted here
// exactly, not just approximately.

describe('resolveDateWindow', () => {
  it('throws BadRequestException when neither boundary is supplied (test #4)', () => {
    expect(() => resolveDateWindow({})).toThrow(BadRequestException);
  });

  it('throws BadRequestException when both boundaries span more than 90 days (test #5)', () => {
    expect(() =>
      resolveDateWindow({
        createdAfter: '2026-01-01T00:00:00.000Z',
        createdBefore: '2026-12-31T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts a range of exactly 90 days', () => {
    const result = resolveDateWindow({
      createdAfter: '2026-06-25T00:00:00.000Z',
      createdBefore: '2026-09-23T00:00:00.000Z',
    });
    expect(result.createdAfter.toISOString()).toBe('2026-06-25T00:00:00.000Z');
    expect(result.createdBefore.toISOString()).toBe('2026-09-23T00:00:00.000Z');
  });

  it('derives createdBefore from createdAfter only, capped at 90 days (test #6, worked example 1)', () => {
    // Pinned "now" well after the derived boundary so min(now(), +90d)
    // resolves to the +90d arithmetic, not a clamp to "now" -- the plan's
    // worked example is about the day-math, not about today's real date.
    jest.useFakeTimers().setSystemTime(new Date('2026-12-01T00:00:00.000Z'));
    try {
      const result = resolveDateWindow({ createdAfter: '2026-09-01T00:00:00.000Z' });
      expect(result.createdBefore.toISOString()).toBe('2026-11-30T00:00:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });

  it('derives createdAfter from createdBefore only (test #6, worked example 2)', () => {
    const result = resolveDateWindow({ createdBefore: '2026-09-23T00:00:00.000Z' });
    expect(result.createdAfter.toISOString()).toBe('2026-06-25T00:00:00.000Z');
  });

  it('caps derived createdBefore at now() when createdAfter + 90 days is in the future', () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    const before = Date.now();
    const result = resolveDateWindow({ createdAfter: soon.toISOString() });
    // createdAfter is in the future, so createdAfter + 90d is also in the
    // future -- min(now(), that) must clamp to "now" at call time.
    expect(result.createdBefore.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.createdBefore.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
