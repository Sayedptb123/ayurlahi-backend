/**
 * Normalises an Indian phone number to E.164 (+91XXXXXXXXXX).
 * - "9074136979"    → "+919074136979"
 * - "919074136979"  → "+919074136979"
 * - "+919074136979" → "+919074136979"  (no-op)
 * - Numbers that already start with a different country code are returned unchanged.
 * - null / undefined are passed through as-is.
 */
export function normalizePhone(phone: string | null | undefined): string | null | undefined {
  if (!phone) return phone;

  const cleaned = phone.trim().replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('+91') && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith('91') && cleaned.length === 12) return '+' + cleaned;
  if (/^[6-9]\d{9}$/.test(cleaned)) return '+91' + cleaned;

  // Already has a different country code or unusual format — return cleaned
  return cleaned;
}
