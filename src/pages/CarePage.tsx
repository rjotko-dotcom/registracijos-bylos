import { useState } from 'react';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../i18n';
import { PixelIcon } from '../components/PixelIcon';
import { Sheet } from '../components/Sheet';
import { Switch } from '../components/Switch';
import { fmtAgo } from '../utils/format';
import { useNow } from '../hooks/useNow';
import type { CareTask } from '../domain/models';
import { AudioManager } from '../audio/AudioManager';

const ICON_CHOICES = ['paw', 'water', 'litter', 'play', 'brush', 'treat', 'pill', 'scale', 'vet', 'nails', 'heart', 'star'];
const COLOR_CHOICES = ['pink', 'sage', 'blue', 'sand', 'lavender'];

export function CarePage() {
  const { t, lang } = useI18n();
  const now = useNow(30_000);
  const careTasks = useAppStore((s) => s.careTasks);
  const careLogs = useAppStore((s) => s.careLogs);
  const logCare = useAppStore((s) => s.logCare);
  const saveCareTask = useAppStore((s) => s.saveCareTask);
  const addCustomCareTask = useAppStore((s) => s.addCustomCareTask);
  const removeCareTask = useAppStore((s) => s.removeCareTask);
  const pushToast = useAppStore((s) => s.pushToast);

  const [manage, setManage] = useState(false);
  const [logTask, setLogTask] = useState<CareTask | null>(null);
  const [logNote, setLogNote] = useState('');
  const [logValue, setLogValue] = useState('');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('paw');
  const [newColor, setNewColor] = useState('pink');

  const lastDone = (taskId: string) => {
    const log = careLogs.find((l) => l.taskId === taskId);
    return log ? new Date(log.doneAt) : null;
  };

  const submitLog = async () => {
    if (!logTask) return;
    const value = logTask.key === 'weight' && logValue ? parseFloat(logValue) : undefined;
    await logCare(logTask, logNote.trim() || undefined, value ?? null);
    AudioManager.playPop();
    setLogTask(null);
    setLogNote('');
    setLogValue('');
    pushToast({ text: t('care.doneToast'), kind: 'success' });
  };

  const move = async (task: CareTask, dir: -1 | 1) => {
    const sorted = [...careTasks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === task.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await saveCareTask({ ...task, order: swap.order });
    await saveCareTask({ ...swap, order: task.order });
  };

  return (
    <div className="page">
      <div className="row-between">
        <h1 className="pixel-title" style={{ fontSize: '1.3rem', margin: 0 }}>{t('care.title')}</h1>
        <button className="btn btn-sm btn-ghost" onClick={() => setManage(!manage)}>
          {manage ? t('common.close') : t('care.editTasks')}
        </button>
      </div>
      <p className="muted small">{t('care.notMedical')}</p>

      {careTasks
        .filter((task) => manage || task.enabled)
        .sort((a, b) => a.order - b.order)
        .map((task) => {
          const last = lastDone(task.id);
          return (
            <div key={task.id} className="panel" style={{ marginBottom: 8 }}>
              <div className="row-between">
                <div className="row" style={{ flex: 1 }}>
                  <PixelIcon name={task.icon} size={24} />
                  <div>
                    <strong>{lang === 'lt' ? task.nameLt : task.nameEn}</strong>
                    <div className="muted small">
                      {t('care.lastDone')}:{' '}
                      {last
                        ? fmtAgo(last, now, lang, t('common.justNow'), t('common.ago'), t('common.h'), t('common.min'))
                        : t('care.never')}
                    </div>
                  </div>
                </div>
                {manage ? (
                  <div className="row">
                    <button className="btn btn-sm btn-ghost" aria-label="Up" onClick={() => move(task, -1)}>↑</button>
                    <button className="btn btn-sm btn-ghost" aria-label="Down" onClick={() => move(task, 1)}>↓</button>
                    <Switch on={task.enabled} label={t('care.enabled')} onChange={(v) => void saveCareTask({ ...task, enabled: v })} />
                    {!task.builtIn && (
                      <button className="btn btn-sm btn-ghost" aria-label={t('common.delete')} onClick={() => void removeCareTask(task.id)}>✕</button>
                    )}
                  </div>
                ) : (
                  <button className="btn btn-sage btn-sm" onClick={() => setLogTask(task)}>
                    {t('care.done')}
                  </button>
                )}
              </div>
            </div>
          );
        })}

      {manage && (
        <div className="panel panel-soft">
          <h3>{t('care.addCustom')}</h3>
          <div className="field">
            <label htmlFor="task-name">{t('care.name')}</label>
            <input id="task-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} />
          </div>
          <div className="field">
            <label>{t('care.icon')}</label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {ICON_CHOICES.map((ic) => (
                <button
                  key={ic}
                  className={`btn btn-sm ${newIcon === ic ? 'btn-primary' : 'btn-ghost'}`}
                  aria-label={ic}
                  onClick={() => setNewIcon(ic)}
                >
                  <PixelIcon name={ic} size={18} />
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>{t('care.color')}</label>
            <div className="row">
              {COLOR_CHOICES.map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => setNewColor(c)}
                  className="btn btn-sm"
                  style={{
                    background: `var(--${c})`,
                    width: 38,
                    minHeight: 38,
                    borderColor: newColor === c ? 'var(--text)' : 'var(--border)',
                  }}
                />
              ))}
            </div>
          </div>
          <button
            className="btn btn-primary btn-wide"
            disabled={!newName.trim()}
            onClick={async () => {
              await addCustomCareTask(newName.trim(), newName.trim(), newIcon, newColor);
              setNewName('');
            }}
          >
            {t('common.add')}
          </button>
        </div>
      )}

      <Sheet open={!!logTask} onClose={() => setLogTask(null)} title={logTask ? (lang === 'lt' ? logTask.nameLt : logTask.nameEn) : ''}>
        {logTask?.key === 'weight' && (
          <div className="field">
            <label htmlFor="care-value">{t('care.value')} (kg)</label>
            <input id="care-value" type="number" step="0.1" inputMode="decimal" value={logValue} onChange={(e) => setLogValue(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="care-note">{t('care.logNote')}</label>
          <input id="care-note" value={logNote} maxLength={200} onChange={(e) => setLogNote(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={submitLog}>{t('care.done')}</button>
          <button className="btn btn-ghost" onClick={() => setLogTask(null)}>{t('common.cancel')}</button>
        </div>
      </Sheet>
    </div>
  );
}
