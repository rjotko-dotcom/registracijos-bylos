import { useMemo, useState } from 'react';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../i18n';
import { PixelIcon } from '../components/PixelIcon';
import { Sheet } from '../components/Sheet';
import { fmtDate, fmtTime, toLocalInputValue } from '../utils/format';
import type { FeedingLog, FoodType } from '../domain/models';

const FOOD_TYPES: FoodType[] = ['dry', 'wet', 'treat', 'mixed', 'custom'];

export function HistoryPage() {
  const { t, lang } = useI18n();
  const feedingLogs = useAppStore((s) => s.feedingLogs);
  const careLogs = useAppStore((s) => s.careLogs);
  const careTasks = useAppStore((s) => s.careTasks);
  const settings = useAppStore((s) => s.settings);
  const updateFeeding = useAppStore((s) => s.updateFeeding);
  const deleteFeeding = useAppStore((s) => s.deleteFeeding);
  const deleteCareLog = useAppStore((s) => s.deleteCareLog);
  const pushToast = useAppStore((s) => s.pushToast);

  const [dayOffset, setDayOffset] = useState(0);
  const [view, setView] = useState<'day' | 'week'>('day');
  const [filter, setFilter] = useState<'all' | 'feed' | 'care'>('all');
  const [editing, setEditing] = useState<FeedingLog | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<FoodType>('dry');
  const [editTime, setEditTime] = useState('');
  const [editNote, setEditNote] = useState('');

  const timeFormat = settings?.timeFormat ?? '24';
  const day = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dayOffset]);
  const dayEnd = useMemo(() => new Date(day.getTime() + 86400_000), [day]);

  const dayFeeds = feedingLogs.filter((l) => {
    const d = new Date(l.fedAt);
    return d >= day && d < dayEnd;
  });
  const dayCare = careLogs.filter((l) => {
    const d = new Date(l.doneAt);
    return d >= day && d < dayEnd;
  });

  const weekStats = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    const feeds = feedingLogs.filter((l) => new Date(l.fedAt) >= from);
    const onTime = feeds.filter((l) => l.timingStatus === 'onTime').length;
    const grams = feeds.reduce((s, l) => s + l.amountGrams, 0);
    const activeDays = new Set(feeds.map((l) => new Date(l.fedAt).toDateString())).size;
    return { total: feeds.length, onTime, grams, activeDays };
  }, [feedingLogs]);

  const dayLabel = dayOffset === 0 ? t('history.today') : dayOffset === -1 ? t('history.yesterday') : fmtDate(day, lang);

  const openEdit = (l: FeedingLog) => {
    setEditing(l);
    setEditAmount(String(l.amountGrams));
    setEditType(l.foodType);
    setEditTime(toLocalInputValue(new Date(l.fedAt)));
    setEditNote(l.note ?? '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    await updateFeeding({
      ...editing,
      amountGrams: Math.max(1, parseInt(editAmount, 10) || editing.amountGrams),
      foodType: editType,
      fedAt: new Date(editTime).toISOString(),
      note: editNote.trim() || undefined,
    });
    setEditing(null);
  };

  const taskName = (taskId: string, key: string) => {
    const task = careTasks.find((ct) => ct.id === taskId);
    if (task) return lang === 'lt' ? task.nameLt : task.nameEn;
    return t(`care.${key}`);
  };

  return (
    <div className="page">
      <h1 className="pixel-title" style={{ fontSize: '1.3rem' }}>{t('history.title')}</h1>

      <div className="row-between" style={{ marginBottom: 10 }}>
        <div className="seg" role="tablist">
          <button className={view === 'day' ? 'on' : ''} role="tab" aria-selected={view === 'day'} onClick={() => setView('day')}>{t('history.day')}</button>
          <button className={view === 'week' ? 'on' : ''} role="tab" aria-selected={view === 'week'} onClick={() => setView('week')}>{t('history.week')}</button>
        </div>
        <div className="seg">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>{t('history.all')}</button>
          <button className={filter === 'feed' ? 'on' : ''} onClick={() => setFilter('feed')}>🍽</button>
          <button className={filter === 'care' ? 'on' : ''} onClick={() => setFilter('care')}>🐾</button>
        </div>
      </div>

      {view === 'day' && (
        <>
          <div className="row-between panel panel-soft" style={{ padding: '8px 12px' }}>
            <button className="btn btn-sm btn-ghost" aria-label="Previous day" onClick={() => setDayOffset((d) => d - 1)}>◀</button>
            <strong>{dayLabel}</strong>
            <button className="btn btn-sm btn-ghost" aria-label="Next day" disabled={dayOffset >= 0} onClick={() => setDayOffset((d) => Math.min(0, d + 1))}>▶</button>
          </div>

          <div className="panel">
            {dayFeeds.length === 0 && dayCare.length === 0 && <div className="muted">{t('history.empty')}</div>}

            {filter !== 'care' &&
              dayFeeds.map((l) => (
                <div key={l.id} className="log-item">
                  <PixelIcon name="bowl" size={20} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {t(`food.${l.foodType}`)} · {l.amountGrams} g
                    </div>
                    <div className="muted small">
                      {fmtTime(new Date(l.fedAt), timeFormat, lang)}
                      {l.plannedAt && ` · ${t('history.planned')}: ${fmtTime(new Date(l.plannedAt), timeFormat, lang)}`}
                      {l.note && ` · ${l.note}`}
                    </div>
                  </div>
                  {l.timingStatus && <span className={`badge badge-${l.timingStatus}`}>{t(`timing.${l.timingStatus}`)}</span>}
                  <button className="btn btn-sm btn-ghost" aria-label={t('feed.edit')} onClick={() => openEdit(l)}>✎</button>
                </div>
              ))}

            {filter !== 'feed' &&
              dayCare.map((l) => (
                <div key={l.id} className="log-item">
                  <PixelIcon name={careTasks.find((ct) => ct.id === l.taskId)?.icon ?? 'paw'} size={20} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{taskName(l.taskId, l.taskKey)}</div>
                    <div className="muted small">
                      {fmtTime(new Date(l.doneAt), timeFormat, lang)}
                      {l.value != null && ` · ${l.value}`}
                      {l.note && ` · ${l.note}`}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    aria-label={t('common.delete')}
                    onClick={async () => {
                      await deleteCareLog(l.id);
                      pushToast({ text: t('care.doneToast'), kind: 'info' });
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      {view === 'week' && (
        <div className="panel">
          <h3>{t('history.weekSummary')}</h3>
          <div className="log-item">
            <PixelIcon name="bowl" size={20} />
            <div style={{ flex: 1 }}>{t('history.meals')}</div>
            <strong>{weekStats.total}</strong>
          </div>
          <div className="log-item">
            <PixelIcon name="star" size={20} />
            <div style={{ flex: 1 }}>{t('history.onTimeShare')}</div>
            <strong>{weekStats.total ? Math.round((weekStats.onTime / weekStats.total) * 100) : 0}%</strong>
          </div>
          <div className="log-item">
            <PixelIcon name="scale" size={20} />
            <div style={{ flex: 1 }}>g</div>
            <strong>{weekStats.grams}</strong>
          </div>
          <div className="log-item">
            <PixelIcon name="heart" size={20} />
            <div style={{ flex: 1 }}>{t('history.consistency')}</div>
            <strong>{weekStats.activeDays}/7</strong>
          </div>
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={t('feed.edit')}>
        <div className="field">
          <label>{t('feed.foodType')}</label>
          <div className="seg" style={{ flexWrap: 'wrap', display: 'flex' }}>
            {FOOD_TYPES.map((ft) => (
              <button key={ft} className={editType === ft ? 'on' : ''} onClick={() => setEditType(ft)}>
                {t(`food.${ft}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="edit-amount">{t('feed.amount')}</label>
          <input id="edit-amount" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="edit-time">{t('feed.time')}</label>
          <input id="edit-time" type="datetime-local" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="edit-note">{t('feed.note')}</label>
          <input id="edit-note" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEdit}>{t('feed.save')}</button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              if (editing) {
                const snapshot = editing;
                await deleteFeeding(snapshot.id);
                setEditing(null);
                pushToast({ text: t('common.delete'), kind: 'info' });
              }
            }}
          >
            {t('feed.delete')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
