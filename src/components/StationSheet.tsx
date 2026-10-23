import { genreColor, genreLabel } from '../data/genres';
import type { Station } from '../data/types';
import { useI18n } from '../i18n';
import {
  countryName,
  languageName,
  periodOfHour,
  stationLocalHour,
  stationLocalTime,
} from '../utils';
import {
  IconClose,
  IconHeart,
  IconPause,
  IconPlay,
  IconShare,
} from './icons';

interface StationSheetProps {
  station: Station;
  isPlaying: boolean;
  saved: boolean;
  onClose: () => void;
  onPlay: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  now: Date;
}

export function StationSheet({
  station,
  isPlaying,
  saved,
  onClose,
  onPlay,
  onToggleSave,
  onShare,
  now,
}: StationSheetProps) {
  const { t, lang } = useI18n();
  const localTime = stationLocalTime(station, lang, now);
  const hour = stationLocalHour(station, now);
  const period = periodOfHour(hour);
  const country = countryName(station.cc, lang, station.country);
  const language = languageName(station.lang, lang, station.lang || '—');
  const tags = station.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);

  return (
    <>
      <button type="button" className="sheet-scrim" onClick={onClose} aria-label={t('close')} />
      <aside className="station-sheet" role="dialog" aria-modal="false" aria-label={station.name}>
        <button type="button" className="sheet-close" onClick={onClose} aria-label={t('close')}>
          <IconClose />
        </button>

        <div className="sheet-eyebrow">
          <i className="genre-dot" style={{ background: genreColor(station.genre) }} />
          <span>{genreLabel(station.genre, lang)}</span>
          <span className="meta-sep">·</span>
          <span>{country}</span>
        </div>

        <h2 className="sheet-title">{station.name}</h2>

        <div className="sheet-now">
          <span className={`period-icon ${period}`} aria-hidden="true">
            {period === 'night' || period === 'evening' ? '☾' : '☀'}
          </span>
          <span>
            {t(period)} · <span className="mono">{localTime}</span>
          </span>
          {station.precision === 0 && (
            <span className="sheet-approx">{t('locationApprox')}</span>
          )}
        </div>

        <div className="sheet-stats">
          <div>
            <span>{t('bitrate')}</span>
            <strong className="mono">
              {station.bitrate > 0 ? `${station.bitrate} kbps` : '—'}
            </strong>
          </div>
          <div>
            <span>{t('codec')}</span>
            <strong className="mono">{station.codec || '—'}</strong>
          </div>
          <div>
            <span>{t('language')}</span>
            <strong>{language}</strong>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="sheet-tags">
            {tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="sheet-actions">
          <button type="button" className="btn primary" onClick={onPlay}>
            {isPlaying ? <IconPause width={16} height={16} /> : <IconPlay width={16} height={16} />}
            {isPlaying ? t('pause') : t('play')}
          </button>
          <button
            type="button"
            className={`btn ghost ${saved ? 'on' : ''}`}
            onClick={onToggleSave}
            aria-pressed={saved}
          >
            <IconHeart width={16} height={16} />
            {saved ? t('saved') : t('save')}
          </button>
          <button type="button" className="btn ghost icon-only" onClick={onShare} aria-label={t('share')}>
            <IconShare width={16} height={16} />
          </button>
        </div>

        {station.homepage && (
          <a
            className="sheet-link"
            href={station.homepage}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('openHomepage')} <span aria-hidden="true">↗</span>
          </a>
        )}

        <div className="sheet-foot mono">
          {station.health == null ? t('demo') : `${t('live')} · ${t('source')}`}
        </div>
      </aside>
    </>
  );
}
