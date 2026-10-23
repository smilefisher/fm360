import { genreColor, genreLabel } from '../data/genres';
import type { Station } from '../data/types';
import { useI18n } from '../i18n';
import { countryName, stationLocalTime } from '../utils';

interface HoverCardProps {
  station: Station | null;
  x: number;
  y: number;
  now: Date;
}

export function HoverCard({ station, x, y, now }: HoverCardProps) {
  const { t, lang } = useI18n();
  if (!station) return null;
  const country = countryName(station.cc, lang, station.country);
  const localTime = stationLocalTime(station, lang, now);
  const left = Math.min(Math.max(12, x + 16), window.innerWidth - 250);
  const top = Math.min(Math.max(12, y + 16), window.innerHeight - 120);

  return (
    <div className="hover-card" style={{ left, top }} aria-hidden="true">
      <div className="hover-eyebrow">
        <i className="genre-dot" style={{ background: genreColor(station.genre) }} />
        {genreLabel(station.genre, lang)}
        <span className="meta-sep">·</span>
        {country}
      </div>
      <strong>{station.name}</strong>
      <div className="hover-foot mono">
        {localTime} <span className="meta-sep">·</span>{' '}
        {station.bitrate > 0 ? `${station.bitrate} kbps` : '—'}
        {station.health == null && (
          <>
            <span className="meta-sep">·</span> {t('demoShort')}
          </>
        )}
      </div>
    </div>
  );
}
