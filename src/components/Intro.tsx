import { useI18n } from '../i18n';
import { Logo } from './Logo';
import { IconPlay } from './icons';

interface IntroProps {
  loading: boolean;
  countries: number;
  stations: number;
  onStart: () => void;
  onExplore: () => void;
}

export function Intro({ loading, countries, stations, onStart, onExplore }: IntroProps) {
  const { t } = useI18n();
  const lines = t('introTitle').split('\n');

  return (
    <section className="intro-overlay" aria-label={t('tagline')}>
      <div className="intro-gradient" />
      <div className="intro-content">
        <div className="intro-brand">
          <Logo />
          <span className="intro-eyebrow">{t('demo')}</span>
        </div>
        <h1 className="intro-title">
          {lines.map((line, index) => (
            <span key={`${line}-${index}`}>{line}</span>
          ))}
        </h1>
        <p className="intro-sub">{t('introSub')}</p>
        <div className="intro-stats mono">
          {loading ? t('loadingHint') : t('introStats', { countries, stations })}
        </div>
        <div className="intro-actions">
          <button className="btn primary intro-start" onClick={onStart} disabled={loading}>
            {loading ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <IconPlay width={16} height={16} />
            )}
            {loading ? t('loading') : t('start')}
          </button>
          <button className="intro-explore" onClick={onExplore} disabled={loading}>
            {t('explore')} <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="intro-credit mono">
          {t('introCredit')}
        </div>
      </div>
    </section>
  );
}
