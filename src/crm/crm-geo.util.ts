/**
 * Geo helpers for field check-ins (B5). Lead lat/lng come back from PostgreSQL
 * as strings (hard rule #5) — callers should parseFloat before passing in.
 */

/** Great-circle distance in metres between two WGS84 points. */
export function haversineMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // earth radius, metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** A check-in farther than this from the registered location is flagged (B5). */
export const VISIT_MISMATCH_THRESHOLD_M = 500;
