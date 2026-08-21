const DAY = 86_400_000

// whole days from today to an ISO yyyy-mm-dd date: 0 = today, 1 = tomorrow,
// negative = already passed. Both sides are floored to midnight so the answer
// does not drift with the time of day.
export function daysUntil(iso: string): number {
  return Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY)
}
