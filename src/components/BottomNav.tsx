import { NavLink } from 'react-router-dom';
import { PixelIcon } from './PixelIcon';
import { useI18n } from '../i18n';

const ITEMS = [
  { to: '/', icon: 'home', key: 'nav.home' },
  { to: '/history', icon: 'book', key: 'nav.history' },
  { to: '/care', icon: 'paw', key: 'nav.care' },
  { to: '/collection', icon: 'chest', key: 'nav.collection' },
  { to: '/settings', icon: 'gear', key: 'nav.settings' },
];

export function BottomNav() {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-ico">
            <PixelIcon name={it.icon} size={22} />
          </span>
          <span>{t(it.key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
