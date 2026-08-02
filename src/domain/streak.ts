// Care-streak computation: consecutive local days (ending today or
// yesterday) that have at least one feeding or care log.

export function computeStreak(now: Date, activityDates: string[]): number {
  const days = new Set(
    activityDates.map((iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let streak = 0;
  const cursor = new Date(now);
  // Today may still be in progress: start from today if active, else yesterday.
  if (!days.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
