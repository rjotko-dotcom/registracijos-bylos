import { useMemo, useState } from 'react';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../i18n';
import { FrejaScene } from '../components/FrejaScene';
import { Sheet } from '../components/Sheet';
import { PixelIcon } from '../components/PixelIcon';
import { useNow } from '../hooks/useNow';
import { computeNextMeal } from '../domain/scheduling';
import { computeMood } from '../domain/mood';
import { levelFraction } from '../domain/xp';
import { timeOfDay } from '../domain/timeOfDay';
import { COLLECTIBLES } from '../domain/collectibles';
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
  const unlocked = useAppStore((s) => s.unlocked);
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
  const today = now.toDateString();

  const doneToday = (taskId: string) => careLogs.some((l) => l.taskId === taskId && new Date(l.doneAt).toDateString() === today);
  const caredToday = useMemo(
    () => new Set(careLogs.filter((l) => new Date(l.doneAt).toDateString() === today).map((l) => l.taskId)).size,
    [careLogs, today],
  );

  const mood = useMemo(
    () =>
      computeMood({
        now,
        lastFedAt: lastMeal ? new Date(lastMeal.fedAt) : null,
        overdue: next.overdue,
        caredToday,
        asleep: timeOfDay(now) === 'night',
      }),
    [now, lastMeal, next.overdue, caredToday],
  );

  const moodName = `home.mood${mood.key.charAt(0).toUpperCase()}${mood.key.slice(1)}`;

  const quickFeed = async () => {
    const log = await logFeeding({
      foodType: lastMeal?.foodType ?? 'dry',
      amountGrams: lastMeal?.amountGrams ?? 40,
    });
    if (log) {
      catBus.emit('fed');
      AudioManager.playPop();
      pushToast({ text: t('home.fedToast'), kind: 'success', undo: () => void deleteFeeding(log.id) });
    }
  };

  const detailedFeed = async () => {
    const log = await logFeeding({
      foodType,
      amountGrams: Math.max(1, parseInt(amount, 10) || 40),
      note: note.trim() || undefined,
      fedAt: customTime ? new Date(customTime) : undefined,
    });
    if (log) {
      catBus.emit('fed');
      setSheetOpen(false);
      setNote('');
      setCustomTime('');
      pushToast({ text: t('home.fedToast'), kind: 'success', undo: () => void deleteFeeding(log.id) });
    }
  };

  const enabledCare = careTasks.filter((c) => c.enabled).sort((a, b) => a.order - b.order).slice(0, 4);
  const collected = unlocked.length;
  const allFound = collected >= COLLECTIBLES.length;

  // Status cards float over the room, the way a game HUD sits on its scene.
  const sceneCards = (
    <>
      <div className="scene-card left">
        <div className="label">{t('home.lastMeal')}</div>
        {lastMeal ? (
          <>
            <div className="value">
              {fmtAgo(new Date(lastMeal.fedAt), now, lang, t('common.justNow'), t('common.ago'), t('common.h'), t('common.min'))}
            </div>
            <div className="sub">
              {t(`food.${lastMeal.foodType}`)} · {lastMeal.amountGrams} g
            </div>
          </>
        ) : (
          <div className="sub">{t('home.noMealsYet')}</div>
        )}
      </div>

      <div className="scene-card right">
        <div className="label">{t('home.nextMeal')}</div>
        {next.at ? (
          <>
            <div className={`value count ${next.overdue ? 'overdue' : ''}`}>
              {next.overdue ? '−' : ''}
              {fmtCountdown(Math.abs(next.at.getTime() - now.getTime()))}
            </div>
            <div className="sub">
              {next.overdue ? t('home.overdue') : `${next.schedule?.name ?? ''} · ${fmtTime(next.at, timeFormat, lang)}`}
            </div>
          </>
        ) : (
          <div className="sub">{t('home.noSchedule')}</div>
        )}
      </div>
    </>
  );

  return (
    <div className="page">
      <header className="home-head">
        <div>
          <h1 className="brand-name">{pet?.name ?? 'Frėja'}</h1>
          <div className="brand-sub">{t('home.subtitle')}</div>
          <div className="brand-tag">
            {t('home.tagline')} <span style={{ color: 'var(--pink)' }}>♥</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <span className="level-chip">
            <PixelIcon name="star" size={13} />
            {t('home.level')} {pet?.level ?? 1}
          </span>
          <div
            className="xp-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(levelFraction({ level: pet?.level ?? 1, currentXp: pet?.currentXp ?? 0, lifetimeXp: 0 }) * 100)}
            aria-label="XP"
          >
            <div style={{ width: `${Math.round(levelFraction({ level: pet?.level ?? 1, currentXp: pet?.currentXp ?? 0, lifetimeXp: 0 }) * 100)}%` }} />
          </div>
          {streak > 1 && (
            <span className="level-chip">
              <PixelIcon name="heart" size={12} /> {streak} {t('home.streak')}
            </span>
          )}
        </div>
      </header>

      <FrejaScene overdue={next.overdue} overlay={sceneCards} />

      <div className="feed-row">
        <button className="btn btn-primary" onClick={quickFeed}>
          <PixelIcon name="bowl" size={20} /> {t('home.fedButton')}
        </button>
        <button className="btn" onClick={() => setSheetOpen(true)} aria-label={t('feed.title')}>
          {t('home.details')} ▾
        </button>
      </div>

      <div className="panel mood">
        <PixelIcon name="heart" size={34} />
        <div className="mood-text">
          <div className="label">{t('home.mood')}</div>
          <div className="value">{t(moodName)}</div>
          <div className="sub">{t(`${moodName}Sub`)}</div>
        </div>
        <div className="mood-meter" role="img" aria-label={`${t('home.mood')}: ${mood.score}/5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={n <= mood.score ? 'on' : ''} />
          ))}
        </div>
      </div>

      <div className="care-grid">
        {enabledCare.map((task) => (
          <button
            key={task.id}
            className={`care-tile ${doneToday(task.id) ? 'done' : ''}`}
            onClick={async () => {
              await logCare(task);
              AudioManager.playPop();
              pushToast({ text: t('care.doneToast'), kind: 'success' });
            }}
          >
            <PixelIcon name={task.icon} size={26} />
            <span className="name">{lang === 'lt' ? task.nameLt : task.nameEn}</span>
            <span className="sub">{doneToday(task.id) ? t('care.done') : t('care.never')}</span>
          </button>
        ))}
      </div>

      <div className="secret">
        <span className="mark">{allFound ? '★' : '?'}</span>
        <div className="body">
          <div className="title">{allFound ? t('home.secretDone') : t('home.secretTitle')}</div>
          <div className="sub">{allFound ? t('home.secretDoneSub') : t('home.secretSub')}</div>
          <div className="progress">
            <div style={{ width: `${Math.round((collected / COLLECTIBLES.length) * 100)}%` }} />
          </div>
        </div>
        <span className="muted small tnum">
          {collected}/{COLLECTIBLES.length}
        </span>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('feed.title')}>
        <div className="field">
          <label>{t('feed.foodType')}</label>
          <div className="seg" role="radiogroup" aria-label={t('feed.foodType')}>
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
          <input
            id="feed-time"
            type="datetime-local"
            value={customTime || toLocalInputValue(new Date())}
            max={toLocalInputValue(new Date())}
            onChange={(e) => setCustomTime(e.target.value)}
          />
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
