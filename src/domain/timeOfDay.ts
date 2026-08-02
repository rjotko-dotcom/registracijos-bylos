export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

export function timeOfDay(now: Date): TimeOfDay {
  const h = now.getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 18) return 'day';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}
