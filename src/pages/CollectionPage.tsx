import { useState } from 'react';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../i18n';
import { PixelIcon } from '../components/PixelIcon';
import { Sheet } from '../components/Sheet';
import { COLLECTIBLES, type CollectibleDef } from '../domain/collectibles';
import { fmtDate } from '../utils/format';

export function CollectionPage() {
  const { t, lang } = useI18n();
  const unlocked = useAppStore((s) => s.unlocked);
  const [selected, setSelected] = useState<CollectibleDef | null>(null);

  const unlockedIds = new Set(unlocked.map((u) => u.collectibleId));
  const record = (id: string) => unlocked.find((u) => u.collectibleId === id);

  return (
    <div className="page">
      <div className="row-between">
        <h1 className="pixel-title" style={{ fontSize: '1.3rem', margin: 0 }}>{t('collection.title')}</h1>
        <span className="level-chip">
          <PixelIcon name="chest" size={14} /> {unlockedIds.size}/{COLLECTIBLES.length}
        </span>
      </div>
      <p className="muted small">{t('collection.hint')}</p>

      <div className="collection-grid">
        {COLLECTIBLES.map((c) => {
          const isUnlocked = unlockedIds.has(c.id);
          return (
            <button
              key={c.id}
              className={`collectible ${isUnlocked ? '' : 'locked'}`}
              onClick={() => setSelected(c)}
              aria-label={isUnlocked ? t(`collectibles.${c.i18nKey}.name`) : t('collection.locked')}
            >
              <span className="c-icon">
                <PixelIcon name={c.icon} size={34} />
              </span>
              <span>{isUnlocked ? t(`collectibles.${c.i18nKey}.name`) : '???'}</span>
            </button>
          );
        })}
      </div>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected && unlockedIds.has(selected.id) ? t(`collectibles.${selected.i18nKey}.name`) : '???'}
      >
        {selected && (
          <>
            <div style={{ textAlign: 'center', margin: '8px 0 14px' }}>
              <PixelIcon name={selected.icon} size={64} className={unlockedIds.has(selected.id) ? '' : 'locked'} />
            </div>
            {unlockedIds.has(selected.id) ? (
              <>
                <p>{t(`collectibles.${selected.i18nKey}.desc`)}</p>
                <p className="muted small">{t(`collectibles.${selected.i18nKey}.how`)}</p>
                {record(selected.id) && (
                  <p className="muted small">
                    {t('collection.unlockedAt')}: {fmtDate(new Date(record(selected.id)!.createdAt), lang)}
                  </p>
                )}
              </>
            ) : (
              <p className="muted">
                {selected.secret ? t('collection.hint') : t(`collectibles.${selected.i18nKey}.how`)}
              </p>
            )}
            <button className="btn btn-wide btn-ghost" onClick={() => setSelected(null)}>
              {t('common.close')}
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}
