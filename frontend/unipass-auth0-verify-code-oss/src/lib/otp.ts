/**
 * Pure OTP input helpers. No React, no DOM — so they can be tested
 * with simple assertions and reused if the UI ever gets rebuilt.
 */

export const OTP_LENGTH = 6;

/**
 * Normalise a raw user-entered string into up-to-`OTP_LENGTH` digits.
 * Strips whitespace, removes any non-digit characters, truncates to
 * the max length. Useful both for single-field and split-field OTP UIs.
 */
export function sanitizeOtp(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

/** True iff `s` is exactly 6 ASCII digits. */
export function isCompleteOtp(s: string): boolean {
  return s.length === OTP_LENGTH && /^\d{6}$/.test(s);
}

/**
 * When the user pastes a long string into one digit box, we splay it
 * across boxes starting from `startIndex`. Returns the updated digit
 * array (never mutates input).
 */
export function pasteSplay(digits: string[], startIndex: number, pasted: string): string[] {
  const clean = sanitizeOtp(pasted);
  const out = digits.slice();
  for (let i = 0; i < clean.length && startIndex + i < OTP_LENGTH; i++) {
    out[startIndex + i] = clean[i];
  }
  return out;
}

/**
 * Handle single-character input at index `i`. Returns (newDigits, focusTarget).
 * `focusTarget` is the index the UI should now focus — typically `i+1`
 * if the user entered a digit, or `i` if they erased.
 */
export function onDigitChange(
  digits: string[],
  i: number,
  raw: string,
): { digits: string[]; focus: number } {
  const clean = raw.replace(/\D/g, "");
  const next = digits.slice();
  if (clean.length === 0) {
    next[i] = "";
    return { digits: next, focus: i };
  }
  // If the user typed/pasted more than one character into a box, splay.
  if (clean.length > 1) {
    const splayed = pasteSplay(digits, i, clean);
    const filled = splayed.findIndex((d, idx) => idx >= i && d === "");
    const focus = filled === -1 ? Math.min(i + clean.length, OTP_LENGTH - 1) : filled;
    return { digits: splayed, focus };
  }
  next[i] = clean;
  return { digits: next, focus: Math.min(i + 1, OTP_LENGTH - 1) };
}

/** Format remaining seconds as `MM:SS`. */
export function formatCountdown(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
