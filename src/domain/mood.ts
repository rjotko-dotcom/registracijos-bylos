// Frėja's mood, derived from real care state — never a punishment, only a
// gentle read of how the day is going. Score is 1..5 and always starts from
// a contented baseline, so an unopened app never makes her unhappy.

export interface MoodInput {
  now: Date;
  lastFedAt: Date | null;
  overdue: boolean;
  caredToday: number; // distinct care tasks logged today
  asleep: boolean;
}

export interface Mood {
  score: number; // 1..5
  key: 'sleepy' | 'hungry' | 'content' | 'happy' | 'blissful';
}

export function computeMood({ now, lastFedAt, overdue, caredToday, asleep }: MoodInput): Mood {
  if (asleep) return { score: 4, key: 'sleepy' };
  if (overdue) return { score: 2, key: 'hungry' };

  let score = 3;
  if (lastFedAt) {
    const hours = (now.getTime() - lastFedAt.getTime()) / 3600_000;
    if (hours < 2) score += 1;
  }
  if (caredToday >= 2) score += 1;
  score = Math.max(1, Math.min(5, score));

  const key = score >= 5 ? 'blissful' : score >= 4 ? 'happy' : 'content';
  return { score, key };
}
