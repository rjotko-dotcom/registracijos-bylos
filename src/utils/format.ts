import type { Language } from '../domain/models';

export function fmtTime(d: Date, timeFormat: '12' | '24', lang: Language): string {
  return d.toLocaleTimeString(lang === 'lt' ? 'lt-LT' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12',
  });
}

export function fmtDate(d: Date, lang: Language): string {
  return d.toLocaleDateString(lang === 'lt' ? 'lt-LT' : 'en-GB', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function fmtAgo(from: Date, now: Date, lang: Language, justNow: string, agoWord: string, hWord: string, minWord: string): string {
  const diffMin = Math.floor((now.getTime() - from.getTime()) / 60000);
  if (diffMin < 1) return justNow;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  const parts = [] as string[];
  if (h > 0) parts.push(`${h} ${hWord}`);
  if (m > 0 && h < 5) parts.push(`${m} ${minWord}`);
  return lang === 'lt' ? `${agoWord} ${parts.join(' ')}` : `${parts.join(' ')} ${agoWord}`;
}

export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
