const EVENING_CUTOFF_HOUR = 18; // 6:00 PM

/**
 * Computes the next review date based on calendar days with an evening cutoff.
 * - Before 6 PM: review starts tomorrow (next calendar day at midnight).
 * - At or after 6 PM: review starts the day after tomorrow (midnight).
 */
export function computeNextReviewDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  const daysToAdd = d.getHours() >= EVENING_CUTOFF_HOUR ? 2 : 1;
  d.setDate(d.getDate() + daysToAdd);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
