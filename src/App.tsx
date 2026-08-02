import { useEffect, useMemo } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { useAppStore } from './state/appStore';
import { I18nProvider, useI18n } from './i18n';
import { BottomNav } from './components/BottomNav';
import { Toasts } from './components/Toasts';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { CarePage } from './pages/CarePage';
import { CollectionPage } from './pages/CollectionPage';
import { SettingsPage } from './pages/SettingsPage';
import { Onboarding } from './pages/Onboarding';
import { AudioManager } from './audio/AudioManager';
import { HapticsManager } from './haptics/HapticsManager';
import { timeOfDay } from './domain/timeOfDay';
import { useNow } from './hooks/useNow';
import { createInAppReminderScheduler, showNotification } from './notifications/scheduler';
import { useRegisterSW } from 'virtual:pwa-register/react';

function UpdateBanner() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  if (!needRefresh) return null;
  return (
    <div className="update-banner">
      <div className="toast toast-reward">
        <span>{t('settings.updateReady')}</span>
        <span className="row">
          <button className="btn btn-sm btn-primary" onClick={() => void updateServiceWorker(true)}>
            {t('settings.updateNow')}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setNeedRefresh(false)} aria-label="Close">✕</button>
        </span>
      </div>
    </div>
  );
}

function OfflineNotice() {
  const { t } = useI18n();
  const pushToast = useAppStore((s) => s.pushToast);
  useEffect(() => {
    const onOffline = () => pushToast({ text: t('errors.offline'), kind: 'info' });
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, [pushToast, t]);
  return null;
}

function Shell() {
  const settings = useAppStore((s) => s.settings);
  const dbError = useAppStore((s) => s.dbError);
  const { t } = useI18n();
  const now = useNow(60_000);

  // Theme
  const isNight = useMemo(() => {
    if (!settings) return false;
    if (settings.theme === 'night') return true;
    if (settings.theme === 'day') return false;
    const tod = timeOfDay(now);
    return tod === 'night';
  }, [settings, now]);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-night', isNight);
    document.documentElement.classList.toggle('reduced-motion', !!settings?.reducedMotion);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', isNight ? '#2b2632' : '#f6efe3');
  }, [isNight, settings?.reducedMotion]);

  // Managers follow settings
  useEffect(() => {
    if (!settings) return;
    AudioManager.setPrefs({ master: settings.soundMaster, purr: settings.soundPurr, meow: settings.soundMeow, ui: settings.soundUi });
    HapticsManager.setEnabled(settings.haptics);
  }, [settings]);

  // In-app reminder scheduler
  useEffect(() => {
    const sched = createInAppReminderScheduler({
      getSchedules: () => useAppStore.getState().schedules,
      getLastMeal: () => useAppStore.getState().feedingLogs[0] ?? null,
      getSettings: () => useAppStore.getState().settings,
      notify: showNotification,
    });
    sched.start();
    return () => sched.stop();
  }, []);

  if (!settings) return null;

  if (!settings.onboardingDone) {
    return <Onboarding />;
  }

  return (
    <>
      <UpdateBanner />
      <OfflineNotice />
      {dbError && (
        <div className="panel" style={{ margin: 12, borderColor: '#c25b5b' }}>
          {t('errors.dbFail')}
        </div>
      )}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/care" element={<CarePage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      <BottomNav />
      <Toasts />
    </>
  );
}

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);
  const lang = useAppStore((s) => s.settings?.language ?? 'lt');

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <span className="pixel-title" style={{ fontSize: '1.2rem' }}>Frėja 🐾</span>
      </div>
    );
  }

  return (
    <I18nProvider lang={lang}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </I18nProvider>
  );
}
