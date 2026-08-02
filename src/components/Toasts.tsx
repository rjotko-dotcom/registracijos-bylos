import { useAppStore } from '../state/appStore';
import { useI18n } from '../i18n';

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  const { t } = useI18n();
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind === 'reward' ? 'toast-reward' : ''}`}>
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                toast.undo?.();
                dismiss(toast.id);
              }}
            >
              {t('home.undo')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
