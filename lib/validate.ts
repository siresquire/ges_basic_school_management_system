export class FieldError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

/**
 * Normalises and validates a Ghana phone number.
 * Accepts 10 digits starting with 0; strips spaces, hyphens, parentheses.
 * Returns null if blank. Throws FieldError("phone") if present but invalid.
 */
export function parsePhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/[\s\-().+]/g, "");
  if (!/^0\d{9}$/.test(digits)) throw new FieldError("phone");
  return digits;
}

/**
 * Validates a Ghana Card number (format: GHA-XXXXXXXXX-X).
 * Returns null if blank. Throws FieldError("ghanacard") if present but invalid.
 */
export function parseGhanaCard(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const val = raw.trim().toUpperCase();
  if (!/^GHA-\d{9}-\d$/.test(val)) throw new FieldError("ghanacard");
  return val;
}
