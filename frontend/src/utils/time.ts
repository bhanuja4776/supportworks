/**
 * Auto-formats a time string into 24-hour `HH:MM` as the user types.
 * - Accepts digits only; strips everything else.
 * - After the 2nd digit, inserts `:` automatically.
 * - Caps hours at 23 and minutes at 59.
 * - Empty input remains empty (so the placeholder can still show).
 *
 * Examples: "0" → "0", "09" → "09", "093" → "09:3", "0930" → "09:30",
 *            "2500" → "23:00", "1265" → "12:59"
 */
export function formatTime24h(raw: string): string {
  const digits = (raw || "").replace(/[^0-9]/g, "").slice(0, 4);
  if (!digits) return "";
  if (digits.length <= 2) {
    // Clamp hour segment to <= 23 while the user is still typing it.
    const h = parseInt(digits, 10);
    if (digits.length === 2 && h > 23) return "23";
    return digits;
  }
  let hh = digits.slice(0, 2);
  let mm = digits.slice(2);
  const hInt = parseInt(hh, 10);
  if (hInt > 23) hh = "23";
  if (mm.length === 2) {
    const mInt = parseInt(mm, 10);
    if (mInt > 59) mm = "59";
  }
  return `${hh}:${mm}`;
}

/** Returns duration in minutes between two 24-hr time strings, or 0 if invalid. */
export function minutesBetween(start: string, end: string): number {
  const s = /^([01]?\d|2[0-3]):([0-5]?\d)$/.exec(start || "");
  const e = /^([01]?\d|2[0-3]):([0-5]?\d)$/.exec(end || "");
  if (!s || !e) return 0;
  const a = parseInt(s[1], 10) * 60 + parseInt(s[2], 10);
  let b = parseInt(e[1], 10) * 60 + parseInt(e[2], 10);
  if (b < a) b += 24 * 60; // overnight shift
  return b - a;
}

/** Formats a duration in minutes to `Xh Ym` (or `Xh` when minutes = 0). */
export function formatDuration(mins: number): string {
  if (!mins || mins < 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
