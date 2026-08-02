import { useRef, useState } from 'react';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../i18n';
import { Switch } from '../components/Switch';
import { Sheet } from '../components/Sheet';
import { PixelIcon } from '../components/PixelIcon';
import { exportToFile, importFromFile } from '../data/export';
import { notificationPermission, requestNotificationPermission } from '../notifications/scheduler';
import type { FeedingSchedule, ScheduleMode } from '../domain/models';

export function SettingsPage() {
  const { t, tl, lang } = useI18n();
  const settings = useAppStore((s) => s.settings);
  const schedules = useAppStore((s) => s.schedules);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const addSchedule = useAppStore((s) => s.addSchedule);
  const updateSchedule = useAppStore((s) => s.updateSchedule);
  const deleteSchedule = useAppStore((s) => s.deleteSchedule);
  const pushToast = useAppStore((s) => s.pushToast);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState<FeedingSchedule | null>(null);
  const [schedName, setSchedName] = useState('');
  const [schedMode, setSchedMode] = useState<ScheduleMode>('fixed');
  const [schedTime, setSchedTime] = useState('08:00');
  const [schedInterval, setSchedInterval] = useState('6');
  const [schedDays, setSchedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [isNew, setIsNew] = useState(false);

  if (!settings) return null;
  const perm = notificationPermission();
  const dayNames = tl('settings.dayNamesShort');

  const openNewSchedule = () => {
    setIsNew(true);
    setEditing(null);
    setSchedName(lang === 'lt' ? 'Maitinimas' : 'Meal');
    setSchedMode('fixed');
    setSchedTime('08:00');
    setSchedInterval('6');
    setSchedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const openEditSchedule = (s: FeedingSchedule) => {
    setIsNew(false);
    setEditing(s);
    setSchedName(s.name);
    setSchedMode(s.mode);
    setSchedTime(s.time ?? '08:00');
    setSchedInterval(String(s.intervalHours ?? 6));
    setSchedDays(s.daysOfWeek?.length ? s.daysOfWeek : [0, 1, 2, 3, 4, 5, 6]);
  };

  const sheetOpen = isNew || !!editing;

  const saveSchedule = async () => {
    const base = {
      name: schedName.trim() || 'Meal',
      mode: schedMode,
      enabled: editing?.enabled ?? true,
      time: schedMode === 'fixed' ? schedTime : undefined,
      daysOfWeek: schedMode === 'fixed' ? schedDays : undefined,
      intervalHours: schedMode === 'interval' ? Math.max(1, parseFloat(schedInterval) || 6) : undefined,
      paused: editing?.paused ?? false,
    };
    if (editing) await updateSchedule({ ...editing, ...base });
    else await addSchedule(base);
    setEditing(null);
    setIsNew(false);
  };

  const seg = (
    value: string,
    options: Array<{ v: string; label: string }>,
    onChange: (v: string) => void,
    label: string,
  ) => (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? 'on' : ''} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="page">
      <h1 className="pixel-title" style={{ fontSize: '1.3rem' }}>{t('settings.title')}</h1>

      <div className="panel">
        <div className="setting-row">
          <span>{t('settings.language')}</span>
          {seg(settings.language, [{ v: 'lt', label: 'Lietuvių' }, { v: 'en', label: 'English' }], (v) => void updateSettings({ language: v as 'lt' | 'en' }), t('settings.language'))}
        </div>
        <div className="setting-row">
          <span>{t('settings.theme')}</span>
          {seg(
            settings.theme,
            [
              { v: 'auto', label: t('settings.themeAuto') },
              { v: 'day', label: t('settings.themeDay') },
              { v: 'night', label: t('settings.themeNight') },
            ],
            (v) => void updateSettings({ theme: v as 'auto' | 'day' | 'night' }),
            t('settings.theme'),
          )}
        </div>
        <div className="setting-row">
          <span>{t('settings.timeFormat')}</span>
          {seg(settings.timeFormat, [{ v: '24', label: '24 h' }, { v: '12', label: '12 h' }], (v) => void updateSettings({ timeFormat: v as '12' | '24' }), t('settings.timeFormat'))}
        </div>
      </div>

      <div className="panel">
        <h3>{t('settings.sound')}</h3>
        <div className="setting-row">
          <span>{t('settings.soundMaster')}</span>
          <Switch on={settings.soundMaster} label={t('settings.soundMaster')} onChange={(v) => void updateSettings({ soundMaster: v })} />
        </div>
        <div className="setting-row">
          <span>{t('settings.soundPurr')}</span>
          <Switch on={settings.soundPurr} label={t('settings.soundPurr')} onChange={(v) => void updateSettings({ soundPurr: v })} />
        </div>
        <div className="setting-row">
          <span>{t('settings.soundMeow')}</span>
          <Switch on={settings.soundMeow} label={t('settings.soundMeow')} onChange={(v) => void updateSettings({ soundMeow: v })} />
        </div>
        <div className="setting-row">
          <span>{t('settings.soundUi')}</span>
          <Switch on={settings.soundUi} label={t('settings.soundUi')} onChange={(v) => void updateSettings({ soundUi: v })} />
        </div>
        <div className="setting-row">
          <span>{t('settings.haptics')}</span>
          <Switch on={settings.haptics} label={t('settings.haptics')} onChange={(v) => void updateSettings({ haptics: v })} />
        </div>
      </div>

      <div className="panel">
        <h3>{t('settings.animationFrequency')}</h3>
        <div className="setting-row">
          <span>{t('settings.animationFrequency')}</span>
          {seg(
            settings.animationFrequency,
            [
              { v: 'calm', label: t('settings.animCalm') },
              { v: 'normal', label: t('settings.animNormal') },
              { v: 'lively', label: t('settings.animLively') },
            ],
            (v) => void updateSettings({ animationFrequency: v as 'calm' | 'normal' | 'lively' }),
            t('settings.animationFrequency'),
          )}
        </div>
        <div className="setting-row">
          <span>{t('settings.reducedMotion')}</span>
          <Switch on={settings.reducedMotion} label={t('settings.reducedMotion')} onChange={(v) => void updateSettings({ reducedMotion: v })} />
        </div>
      </div>

      <div className="panel">
        <h3>{t('settings.notifications')}</h3>
        <p className="muted small">
          {perm === 'granted' && t('settings.notifGranted')}
          {perm === 'denied' && t('settings.notifDenied')}
          {perm === 'default' && t('settings.notifDefault')}
          {perm === 'unsupported' && t('settings.notifUnsupported')}
        </p>
        {perm !== 'unsupported' && perm !== 'granted' && (
          <button
            className="btn btn-sm btn-wide"
            onClick={async () => {
              const res = await requestNotificationPermission();
              void updateSettings({ notificationsEnabled: res === 'granted' });
            }}
          >
            {t('settings.notifRequest')}
          </button>
        )}
        {perm === 'granted' && (
          <div className="setting-row">
            <span>{t('settings.notifications')}</span>
            <Switch on={settings.notificationsEnabled} label={t('settings.notifications')} onChange={(v) => void updateSettings({ notificationsEnabled: v })} />
          </div>
        )}
        <p className="muted small">{t('settings.notifPwaHint')}</p>
        <div className="setting-row">
          <span>{t('settings.quietHours')}</span>
          <Switch on={settings.quietHours.enabled} label={t('settings.quietHours')} onChange={(v) => void updateSettings({ quietHours: { ...settings.quietHours, enabled: v } })} />
        </div>
        {settings.quietHours.enabled && (
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="qh-from">{t('settings.from')}</label>
              <input id="qh-from" type="time" value={settings.quietHours.from} onChange={(e) => void updateSettings({ quietHours: { ...settings.quietHours, from: e.target.value } })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="qh-to">{t('settings.to')}</label>
              <input id="qh-to" type="time" value={settings.quietHours.to} onChange={(e) => void updateSettings({ quietHours: { ...settings.quietHours, to: e.target.value } })} />
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="row-between" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>{t('settings.schedules')}</h3>
          <button className="btn btn-sm" onClick={openNewSchedule}>+ {t('settings.addSchedule')}</button>
        </div>
        {schedules.length === 0 && <p className="muted small">{t('home.noSchedule')}</p>}
        {schedules.map((s) => (
          <div key={s.id} className="setting-row">
            <div>
              <strong>{s.name}</strong>
              <div className="muted small">
                {s.mode === 'fixed'
                  ? `${t('settings.modeFixed')} · ${s.time}`
                  : `${t('settings.modeInterval')} · ${s.intervalHours} ${t('common.h')}${s.paused ? ` · ${t('settings.paused')}` : ''}`}
              </div>
            </div>
            <div className="row">
              <Switch on={s.enabled} label={s.name} onChange={(v) => void updateSchedule({ ...s, enabled: v })} />
              <button className="btn btn-sm btn-ghost" aria-label={t('feed.edit')} onClick={() => openEditSchedule(s)}>✎</button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>{t('settings.data')}</h3>
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => void exportToFile()}>
            {t('settings.exportData')}
          </button>
          <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
            {t('settings.importData')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                await importFromFile(file);
                pushToast({ text: t('settings.importOk'), kind: 'success' });
                setTimeout(() => window.location.reload(), 800);
              } catch {
                pushToast({ text: t('settings.importBad'), kind: 'info' });
              }
            }}
          />
        </div>
        <button
          className="btn btn-sm btn-wide"
          style={{ borderColor: '#c25b5b', color: '#c25b5b' }}
          onClick={async () => {
            if (window.confirm(t('settings.resetConfirm'))) {
              const { getRepositories } = await import('../data/repositories');
              await getRepositories().porter.resetAll();
              localStorage.removeItem('freja.firedReminders');
              window.location.reload();
            }
          }}
        >
          {t('settings.reset')}
        </button>
      </div>

      <div className="panel panel-soft">
        <h3>{t('settings.install')}</h3>
        <p className="muted small">{t('settings.installHint')}</p>
        <p className="muted small">
          <PixelIcon name="heart" size={12} /> {t('settings.version')} 1.0.0 · {t('settings.offlineReady')}
        </p>
      </div>

      <Sheet open={sheetOpen} onClose={() => { setEditing(null); setIsNew(false); }} title={isNew ? t('settings.addSchedule') : t('feed.edit')}>
        <div className="field">
          <label htmlFor="sched-name">{t('settings.scheduleName')}</label>
          <input id="sched-name" value={schedName} onChange={(e) => setSchedName(e.target.value)} maxLength={40} />
        </div>
        <div className="field">
          <label>{t('settings.mode')}</label>
          {seg(
            schedMode,
            [
              { v: 'fixed', label: t('settings.modeFixed') },
              { v: 'interval', label: t('settings.modeInterval') },
            ],
            (v) => setSchedMode(v as ScheduleMode),
            t('settings.mode'),
          )}
        </div>
        {schedMode === 'fixed' ? (
          <>
            <div className="field">
              <label htmlFor="sched-time">{t('settings.timeLabel')}</label>
              <input id="sched-time" type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('settings.days')}</label>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {dayNames.map((dn, idx) => (
                  <button
                    key={idx}
                    className={`btn btn-sm ${schedDays.includes(idx) ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSchedDays((d) => (d.includes(idx) ? d.filter((x) => x !== idx) : [...d, idx]))}
                  >
                    {dn}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="field">
            <label htmlFor="sched-interval">{t('settings.intervalHours')}</label>
            <input id="sched-interval" type="number" min={1} max={24} step={0.5} value={schedInterval} onChange={(e) => setSchedInterval(e.target.value)} />
          </div>
        )}
        {editing && editing.mode === 'interval' && (
          <div className="setting-row">
            <span>{t('settings.paused')}</span>
            <Switch on={!!editing.paused} label={t('settings.paused')} onChange={(v) => setEditing({ ...editing, paused: v })} />
          </div>
        )}
        <div className="row">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveSchedule}>{t('common.save')}</button>
          {editing && (
            <button
              className="btn btn-ghost"
              onClick={async () => {
                await deleteSchedule(editing.id);
                setEditing(null);
              }}
            >
              {t('common.delete')}
            </button>
          )}
        </div>
      </Sheet>
    </div>
  );
}
