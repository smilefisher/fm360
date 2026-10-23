import type { ViewMode } from '../data/types';
import { useI18n, type Lang } from '../i18n';
import { Logo } from './Logo';
import { IconGlobe, IconSearch, IconSky } from './icons';

interface TopBarProps {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  onSearch: () => void;
  lang: Lang;
  onLang: () => void;
  demo?: boolean;
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function TopBar({ mode, onMode, onSearch, lang, onLang, demo }: TopBarProps) {
  const { t } = useI18n();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Logo />
        {demo && <span className="demo-pill">{t('demoShort')}</span>}
      </div>

      <div className="view-toggle" role="group" aria-label={t('view')}>
        <button
          type="button"
          className={mode === 'globe' ? 'on' : ''}
          onClick={() => onMode('globe')}
          aria-label={t('globe')}
          aria-pressed={mode === 'globe'}
        >
          <IconGlobe />
          <span>{t('globe')}</span>
        </button>
        <button
          type="button"
          className={mode === 'sky' ? 'on' : ''}
          onClick={() => onMode('sky')}
          aria-label={t('sky')}
          aria-pressed={mode === 'sky'}
        >
          <IconSky />
          <span>{t('sky')}</span>
        </button>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="search-trigger"
          onClick={onSearch}
          aria-label={t('search')}
        >
          <IconSearch />
          <span className="search-label">{t('search')}</span>
          <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <button type="button" className="lang-btn" onClick={onLang} aria-label={t('language')}>
          {lang === 'zh' ? 'EN' : '中'}
        </button>
      </div>
    </header>
  );
}
