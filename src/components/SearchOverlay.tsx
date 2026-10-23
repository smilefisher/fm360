import { useEffect, useMemo, useRef, useState } from 'react';
import { genreColor, genreLabel } from '../data/genres';
import type { Station } from '../data/types';
import { useI18n } from '../i18n';
import {
  countryName,
  formatNumber,
  languageName,
  normalizeSearch,
  stationLocalTime,
  stationMatches,
} from '../utils';
import { IconClose, IconSearch } from './icons';

interface SearchOverlayProps {
  open: boolean;
  stations: Station[];
  onClose: () => void;
  onPlay: (station: Station) => void;
  now: Date;
}

export function SearchOverlay({ open, stations, onClose, onPlay, now }: SearchOverlayProps) {
  const { t, lang } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  const results = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return [...stations].sort((a, b) => b.pop - a.pop).slice(0, 24);

    const scored = stations
      .filter((station) => stationMatches(station, query, lang))
      .map((station) => {
        const name = normalizeSearch(station.name);
        const country = normalizeSearch(`${station.country} ${station.cc}`);
        const tags = normalizeSearch(station.tags);
        const genre = normalizeSearch(genreLabel(station.genre, lang));
        const language = normalizeSearch(station.lang);
        let score = 0;
        if (name === q) score += 1000;
        else if (name.startsWith(q)) score += 400;
        else if (name.includes(q)) score += 200;
        if (country.includes(q)) score += 80;
        if (genre.includes(q)) score += 60;
        if (language.includes(q)) score += 40;
        if (tags.includes(q)) score += 30;
        return { station, score };
      })
      .sort((a, b) => b.score - a.score || b.station.pop - a.station.pop);
    return scored.slice(0, 48).map((item) => item.station);
  }, [query, stations, lang]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const play = (station: Station | undefined) => {
    if (!station) return;
    onPlay(station);
    onClose();
  };

  return (
    <div
      className="search-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="search-panel" role="dialog" aria-modal="true" aria-label={t('search')}>
        <div className="search-head">
          <IconSearch width={20} height={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(results.length - 1, value + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(0, value - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                play(results[active]);
              }
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQuery('')}
              aria-label={t('clear')}
            >
              <IconClose width={14} height={14} />
            </button>
          )}
          <kbd className="search-esc">Esc</kbd>
          <button type="button" className="search-close" onClick={onClose} aria-label={t('close')}>
            <IconClose />
          </button>
        </div>

        {!query && <div className="search-hint">{t('searchHint')}</div>}

        <div className="search-results" role="listbox" aria-label={t('results', { n: results.length })}>
          {results.length === 0 && (
            <div className="search-empty">
              <strong>{t('searchEmpty')}</strong>
              <span>{t('searchHint')}</span>
            </div>
          )}
          {results.map((station, index) => {
            const country = countryName(station.cc, lang, station.country);
            const localTime = stationLocalTime(station, lang, now);
            return (
              <button
                type="button"
                key={station.id}
                className={`search-row ${index === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => play(station)}
                role="option"
                aria-selected={index === active}
              >
                <i className="genre-dot" style={{ background: genreColor(station.genre) }} />
                <span className="search-main">
                  <strong>{station.name}</strong>
                  <span>
                    {country} <span className="meta-sep">·</span>{' '}
                    <span className="mono">{localTime}</span>{' '}
                    <span className="meta-sep">·</span>{' '}
                    {languageName(station.lang, lang, station.lang || '—')}
                  </span>
                </span>
                <span className="search-side">
                  <span>{genreLabel(station.genre, lang)}</span>
                  <span className="mono">
                    {station.bitrate > 0 ? `${station.bitrate} kbps` : '—'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="search-foot">
          <span>{t('results', { n: formatNumber(results.length, lang) })}</span>
          <span className="mono">{query ? '' : t('keyboardHint')}</span>
        </div>
      </div>
    </div>
  );
}
