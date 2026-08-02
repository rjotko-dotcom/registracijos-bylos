import { useMemo, useState } from 'react';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../i18n';
import { FrejaScene } from '../components/FrejaScene';
import { Sheet } from '../components/Sheet';
import { PixelIcon } from '../components/PixelIcon';
import { useNow } from '../hooks/useNow';
import { computeNextMeal } from '../domain/scheduling';
import { levelFraction } from '../domain/xp';
import { timeOfDay } from '../domain/timeOfDay';
import { fmtAgo, fmtCountdown, fmtTime, toLocalInputValue } from '../utils/format';
import type { FoodType } from '../domain/models';
import { catBus } from '../cat/bus';
import { AudioManager } from '../audio/AudioManager';

const FOOD_TYPES: FoodType[] = ['dry', 'wet', 'treat', 'mixed', 'custom'];

export function HomePage() {
  const { t, lang } = useI18n();
  const now = useNow(1000);
  const pet = useAppStore((s) => s.pet);
  const settings = useAppStore((s) => s.settings);
  const schedules = useAppStore((s) => s.schedules);
  const feedingLogs = useAppStore((s) => s.feedingLogs);
  const careTasks = useAppStore((s) => s.careTasks);
  const careLogs = useAppStore((s) => s.careLogs);
  const streak = useAppStore((s) => s.streak);
  const logFeeding = useAppStore((s) => s.logFeeding);
  const deleteFeeding = useAppStore((s) => s.deleteFeeding);
  const logCare = useAppStore((s) => s.logCare);
  const pushToast = useAppStore((s) => s.pushToast);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [foodType, setFoodType] = useState<FoodType>('dry');
  const [amount, setAmount] = useState('40');
  const [note, setNote] = useState('');
  const [customTime, setCustomTime] = useState('');

  const lastMeal = feedingLogs[0] ?? null;
  const next = useMemo(() => computeNextMeal(now, schedules, lastMeal), [now, schedules, lastMeal]);
  const timeFormat = settings?.timeFormat ?? '24';

  const greeting = t(`greeting.${timeOfDay(now)}`);

  const quickFeed = async () => {
    const lastType = lastMeal?.foodType ?? 'dry';
    const lastAmount = lastMeal?.amountGrams ?? 40;
    const log = await logFeeding({ foodType: lastType, amountGrams: lastAmount });
    if (log) {
      catBus.emit('fed');
      AudioManager.playPop();
      pushToast({
        text: t('home.fedToast'),
        kind: 'success',
        undo: () => void deleteFeeding(log.id),
      });
    }
  };

  const detailedFeed = async () => {
    const fedAt = customTime ? new Date(customTime) : undefined;
    const grams = Math.max(1, parseInt(amount, 10) || 40);
    const log = await logFeeding({ foodType, amountGrams: grams, note: note.trim() || undefined, fedAt });
    if (log) {
      catBus.emit('fed');
      setSheetOpen(false);
      setNote('');
      setCustomTime('');
      pushToast({ text: t('home.fedToast'), kind: 'success', undo: () => void deleteFeeding(log.id) });
    }
  };

  const enabledCare = careTasks.filter((c) => c.enabled).slice(0, 4);
  const doneToday = (taskId: string) =>
    careLogs.some((l) => l.taskId === taskId && new Date(l.doneAt).toDateString() === now.toDateString());

  return (
    <div className="page">
      <div className="home-top">
        <div>
          <h1 className="pixel-title" style={{ fontSize: '1.5rem', margin: 0 }}>
            {pet?.name ?? 'Frėja'}
          </h1>
          <span className="muted">{greeting}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="level-chip">
            <PixelIcon name="star" size={14} />
            {t('home.level')} {pet?.level ?? 1}
          </span>
          <div className="xp-bar" aria-label={`XP ${pet?.currentXp ?? 0}`}>
            <div style={{ width: `${Math.round(levelFraction({ level: pet?.level ?? 1, currentXp: pet?.currentXp ?? 0, lifetimeXp: 0 }) * 100)}%` }} />
          </div>
        </div>
      </div>

      <FrejaScene overdue={next.overdue} />

      <div className="meal-status-grid">
        <div className="panel" style={{ margin: 0 }}>
          <div className="row" style={{ marginBottom: 4 }}>
            <PixelIcon name="bowl" size={18} />
            <strong className="small">{t('home.lastMeal')}</strong>
          </div>
          {lastMeal ? (
            <>
              <div style={{ fontWeight: 700 }}>
                {fmtAgo(new Date(lastMeal.fedAt), now, lang, t('common.justNow'), t('common.ago'), t('common.h'), t('common.min'))}
              </div>
              <div className="muted">
                {t(`food.${lastMeal.foodType}`)} · {lastMeal.amountGrams} g · {fmtTime(new Date(lastMeal.fedAt), timeFormat, lang)}
              </div>
            </>
          ) : (
            <div className="muted">{t('home.noMealsYet')}</div>
          )}
        </div>
        <div className="panel" style={{ margin: 0 }}>
          <div className="row" style={{ marginBottom: 4 }}>
            <PixelIcon name="bell" size={18} />
            <strong className="small">{t('home.nextMeal')}</strong>
          </div>
          {next.at ? (
            <>
              <div className={`countdown ${next.overdue ? 'overdue' : ''}`}>
                {next.overdue ? '−' : ''}
                {fmtCountdown(Math.abs(next.at.getTime() - now.getTime()))}
              </div>
              <div className="muted">
                {next.overdue ? t('home.overdue') : `${next.schedule?.name ?? ''} · ${fmtTime(next.at, timeFormat, lang)}`}
              </div>
            </>
          ) : (
            <div className="muted">{t('home.noSchedule')}</div>
          )}
        </div>
      </div>

      <button className="btn btn-primary btn-wide" style={{ marginBottom: 8 }} onClick={quickFeed}>
        <PixelIcon name="bowl" size={20} /> {t('home.fedButton')}
      </button>
      <button className="btn btn-ghost btn-wide btn-sm" style={{ marginBottom: 14 }} onClick={() => setSheetOpen(true)}>
        {t('home.details')} ▾
      </button>

      <div className="panel panel-soft">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{t('home.quickCare')}</h3>
          {streak > 1 && (
            <span className="level-chip">
              <PixelIcon name="star" size={12} /> {streak} {t('home.streak')}
            </span>
          )}
        </div>
        <div className="quick-care-grid">
          {enabledCare.map((task) => (
            <button
              key={task.id}
              className={`care-chip ${doneToday(task.id) ? 'done-today' : ''}`}
              onClick={async () => {
                await logCare(task);
                AudioManager.playPop();
                pushToast({ text: t('care.doneToast'), kind: 'success' });
              }}
            >
              <PixelIcon name={task.icon} size={22} />
              <span>{lang === 'lt' ? task.nameLt : task.nameEn}</span>
            </button>
          ))}
        </div>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('feed.title')}>
        <div className="field">
          <label>{t('feed.foodType')}</label>
          <div className="seg" role="radiogroup" aria-label={t('feed.foodType')} style={{ flexWrap: 'wrap', display: 'flex' }}>
            {FOOD_TYPES.map((ft) => (
              <button key={ft} className={foodType === ft ? 'on' : ''} role="radio" aria-checked={foodType === ft} onClick={() => setFoodType(ft)}>
                {t(`food.${ft}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="feed-amount">{t('feed.amount')}</label>
          <input id="feed-amount" type="number" inputMode="numeric" min={1} max={500} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="feed-time">{t('feed.time')}</label>
          <input id="feed-time" type="datetime-local" value={customTime || toLocalInputValue(new Date())} max={toLocalInputValue(new Date())} onChange={(e) => setCustomTime(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="feed-note">{t('feed.note')}</label>
          <input id="feed-note" type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={detailedFeed}>
            {t('feed.save')}
          </button>
          <button className="btn btn-ghost" onClick={() => setSheetOpen(false)}>
            {t('feed.cancel')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
