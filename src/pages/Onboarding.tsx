import { useState } from 'react';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../i18n';
import { requestNotificationPermission } from '../notifications/scheduler';
import idleImg from '../assets/freja/idle/freja-idle-01.png';
import purrImg from '../assets/freja/purr/freja-purr-01.png';
import meowImg from '../assets/freja/meow/freja-meow-02.png';
import type { ScheduleMode } from '../domain/models';

type Mode = ScheduleMode | 'both';

export function Onboarding() {
  const { t, lang } = useI18n();
  const updateSettings = useAppStore((s) => s.updateSettings);
  const addSchedule = useAppStore((s) => s.addSchedule);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>('fixed');
  const [time, setTime] = useState('08:00');
  const [interval, setIntervalH] = useState('6');

  const finish = async (withNotifs: boolean) => {
    if (mode === 'fixed' || mode === 'both') {
      await addSchedule({
        name: lang === 'lt' ? 'Pusryčiai' : 'Breakfast',
        mode: 'fixed',
        enabled: true,
        time,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      });
    }
    if (mode === 'interval' || mode === 'both') {
      await addSchedule({
        name: lang === 'lt' ? 'Kas kelias valandas' : 'Every few hours',
        mode: 'interval',
        enabled: true,
        intervalHours: Math.max(1, parseFloat(interval) || 6),
        paused: false,
      });
    }
    if (withNotifs) {
      const res = await requestNotificationPermission();
      await updateSettings({ notificationsEnabled: res === 'granted' });
    }
    await updateSettings({ onboardingDone: true });
  };

  const skip = () => void updateSettings({ onboardingDone: true });

  const steps = [
    // 0 — welcome + language
    <div key="w" className="onboarding">
      <img className="art" src={idleImg} alt="Frėja" />
      <h1 className="pixel-title" style={{ textAlign: 'center' }}>{t('onboarding.welcome')}</h1>
      <p className="muted" style={{ textAlign: 'center' }}>{t('onboarding.welcomeSub')}</p>
      <div className="seg" style={{ alignSelf: 'center' }}>
        <button className="on" onClick={() => { void updateSettings({ language: 'lt' }); setStep(1); }}>Lietuvių</button>
        <button onClick={() => { void updateSettings({ language: 'en' }); setStep(1); }}>English</button>
      </div>
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={skip}>{t('onboarding.skip')}</button>
    </div>,
    // 1 — feeding mode
    <div key="m" className="onboarding">
      <h2 className="pixel-title" style={{ textAlign: 'center' }}>{t('onboarding.feedingMode')}</h2>
      {(['fixed', 'interval', 'both'] as Mode[]).map((m) => (
        <button key={m} className={`btn btn-wide ${mode === m ? 'btn-primary' : ''}`} onClick={() => setMode(m)}>
          {m === 'fixed' ? t('onboarding.fixedDesc') : m === 'interval' ? t('onboarding.intervalDesc') : t('onboarding.bothDesc')}
        </button>
      ))}
      <div className="row">
        <button className="btn btn-ghost" onClick={() => setStep(0)}>{t('onboarding.back')}</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>{t('onboarding.next')}</button>
      </div>
    </div>,
    // 2 — first schedule
    <div key="s" className="onboarding">
      <h2 className="pixel-title" style={{ textAlign: 'center' }}>{t('onboarding.firstSchedule')}</h2>
      {(mode === 'fixed' || mode === 'both') && (
        <div className="field">
          <label htmlFor="ob-time">{t('settings.timeLabel')}</label>
          <input id="ob-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      )}
      {(mode === 'interval' || mode === 'both') && (
        <div className="field">
          <label htmlFor="ob-int">{t('settings.intervalHours')}</label>
          <input id="ob-int" type="number" min={1} max={24} value={interval} onChange={(e) => setIntervalH(e.target.value)} />
        </div>
      )}
      <div className="row">
        <button className="btn btn-ghost" onClick={() => setStep(1)}>{t('onboarding.back')}</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(3)}>{t('onboarding.next')}</button>
      </div>
    </div>,
    // 3 — notifications
    <div key="n" className="onboarding">
      <img className="art" src={meowImg} alt="" />
      <h2 className="pixel-title" style={{ textAlign: 'center' }}>{t('onboarding.reminders')}</h2>
      <p className="muted" style={{ textAlign: 'center' }}>{t('onboarding.remindersDesc')}</p>
      <button className="btn btn-primary btn-wide" onClick={() => { setStep(4); }}>
        {t('onboarding.next')}
      </button>
    </div>,
    // 4 — interactions
    <div key="i" className="onboarding">
      <img className="art" src={purrImg} alt="" />
      <h2 className="pixel-title" style={{ textAlign: 'center' }}>{t('onboarding.interactions')}</h2>
      <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-soft)' }}>
        <li>{t('onboarding.tipPress')}</li>
        <li>{t('onboarding.tipHold')}</li>
        <li>{t('onboarding.tipTaps')}</li>
        <li>{t('onboarding.tipSecrets')}</li>
      </ul>
      <button className="btn btn-primary btn-wide" onClick={() => void finish(true)}>
        {t('onboarding.start')} 🐾
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => void finish(false)}>
        {t('onboarding.skip')}
      </button>
    </div>,
  ];

  return (
    <>
      {steps[step]}
      <div className="dots" style={{ paddingBottom: 20 }}>
        {steps.map((_, i) => (
          <span key={i} className={i === step ? 'on' : ''} />
        ))}
      </div>
    </>
  );
}
