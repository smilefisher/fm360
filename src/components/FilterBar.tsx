import { GENRE_IDS, genreColor, genreLabel } from '../data/genres';
import {
  REGIONS,
  regionLabel,
  type RegionId,
  type RegionPref,
} from '../data/regions';
import { useI18n } from '../i18n';
import { formatNumber } from '../utils';
import { IconChevron } from './icons';

interface FilterBarProps {
  region: RegionPref;
  onRegion: (region: RegionPref) => void;
  activeGenres: Set<string>;
  onToggleGenre: (genre: string) => void;
  onClearGenres: () => void;
  onlyPlayable: boolean;
  onTogglePlayable: () => void;
  detected: RegionId;
  count: number;
}

export function FilterBar({
  region,
  onRegion,
  activeGenres,
  onToggleGenre,
  onClearGenres,
  onlyPlayable,
  onTogglePlayable,
  detected,
  count,
}: FilterBarProps) {
  const { t, lang } = useI18n();

  return (
    <div className="filterbar">
      <label className="region-select">
        <span className="region-label">{t('region')}</span>
        <span className="region-value">
          <select
            value={region}
            onChange={(event) => onRegion(event.target.value as RegionPref)}
            aria-label={t('region')}
          >
            <option value="auto">
              {t('regionAuto')} · {regionLabel(detected, lang)}
            </option>
            <option value="all">{t('regionAll')}</option>
            {REGIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {regionLabel(item.id, lang)}
              </option>
            ))}
          </select>
          <IconChevron width={14} height={14} />
        </span>
      </label>

      <div className="genre-chips" role="group" aria-label={t('genre')}>
        <button
          type="button"
          className={`chip ${activeGenres.size === 0 ? 'on' : ''}`}
          onClick={onClearGenres}
        >
          <i className="chip-dot all" />
          {t('allGenres')}
        </button>
        {GENRE_IDS.map((id) => {
          const active = activeGenres.has(id);
          return (
            <button
              type="button"
              key={id}
              className={`chip ${active ? 'on' : ''}`}
              style={{ ['--chip-color' as string]: genreColor(id) }}
              onClick={() => onToggleGenre(id)}
              aria-pressed={active}
            >
              <i className="chip-dot" />
              {genreLabel(id, lang)}
            </button>
          );
        })}
      </div>

      <div className="filter-right">
        <button
          type="button"
          className={`switch ${onlyPlayable ? 'on' : ''}`}
          role="switch"
          aria-label={t('onlyPlayable')}
          aria-checked={onlyPlayable}
          onClick={onTogglePlayable}
        >
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
          <span className="switch-label">{t('onlyPlayable')}</span>
        </button>
        <span className="filter-count mono">{formatNumber(count, lang)}</span>
      </div>
    </div>
  );
}
