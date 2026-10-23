import { useState } from 'react';
import { genreColor, genreLabel } from '../data/genres';
import type { Station } from '../data/types';
import { useI18n } from '../i18n';
import type { PlayerApi } from '../player/usePlayer';
import { countryName, stationLocalTime } from '../utils';
import {
  IconHeart,
  IconMoon,
  IconNext,
  IconPause,
  IconPlay,
  IconPrevious,
  IconShare,
  IconVolume,
  IconVolumeOff,
} from './icons';

interface PlayerDockProps {
  player: PlayerApi;
  station: Station | null;
  saved: boolean;
  onToggleSave: () => void;
  onOpen: () => void;
  onShare: () => void;
  now: Date;
}

export function PlayerDock({
  player,
  station,
  saved,
  onToggleSave,
  onOpen,
  onShare,
  now,
}: PlayerDockProps) {
  const { t, lang } = useI18n();
  const [sleepOpen, setSleepOpen] = useState(false);

  if (!station) {
    return (
      <div className="player-dock is-empty">
        <button
          type="button"
          className="play-main"
          onClick={player.toggle}
          aria-label={t('play')}
        >
          <IconPlay width={20} height={20} />
        </button>
        <div className="player-meta static">
          <span className="player-eyebrow">{t('pressPlay')}</span>
          <strong>{t('tagline')}</strong>
          <span className="player-sub">{t('sub')}</span>
        </div>
        <div className="player-actions">
          <button type="button" className="icon-action" onClick={player.next} aria-label={t('next')}>
            <IconNext />
          </button>
        </div>
      </div>
    );
  }

  const localTime = stationLocalTime(station, lang, now);
  const country = countryName(station.cc, lang, station.country);
  const bitrate = station.bitrate > 0 ? `${station.bitrate} kbps` : '—';

  return (
    <div className={`player-dock ${player.isPlaying ? 'is-playing' : ''}`}>
      <button
        type="button"
        className="play-main"
        onClick={player.toggle}
        aria-label={player.isPlaying ? t('pause') : t('play')}
      >
        {player.isPlaying ? (
          <IconPause width={20} height={20} />
        ) : (
          <IconPlay width={20} height={20} />
        )}
      </button>

      <button type="button" className="player-meta" onClick={onOpen}>
        <span className="player-eyebrow">
          {player.isPlaying ? (
            <span className="eq" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <span className="live-dot" aria-hidden="true" />
          )}
          <span className="live-label">{t('live')}</span>
          <span className="meta-sep">·</span>
          <span>{country}</span>
          <span className="meta-sep">·</span>
          <span className="mono">{localTime}</span>
          {player.sleepRemaining != null && (
            <>
              <span className="meta-sep">·</span>
              <span className="sleep-remaining mono">
                <IconMoon width={12} height={12} /> {player.sleepRemaining}
              </span>
            </>
          )}
        </span>
        <strong className="player-title">{station.name}</strong>
        <span className="player-sub">
          <i className="genre-dot" style={{ background: genreColor(station.genre) }} />
          {genreLabel(station.genre, lang)}
          <span className="meta-sep">·</span>
          <span className="mono">{bitrate}</span>
          {station.health == null && (
            <>
              <span className="meta-sep">·</span>
              <span className="sample-tag">{t('demoShort')}</span>
            </>
          )}
        </span>
      </button>

      <div className="player-actions">
        <button
          type="button"
          className="icon-action"
          onClick={player.previous}
          disabled={!player.canPrevious}
          aria-label={t('previous')}
          title={t('previous')}
        >
          <IconPrevious />
        </button>
        <button type="button" className="icon-action" onClick={player.next} aria-label={t('next')}>
          <IconNext />
        </button>
        <button
          type="button"
          className={`icon-action ${saved ? 'on' : ''}`}
          onClick={onToggleSave}
          aria-label={saved ? t('saved') : t('save')}
          aria-pressed={saved}
        >
          <IconHeart />
        </button>
        <button
          type="button"
          className="icon-action hide-mobile"
          onClick={onShare}
          aria-label={t('share')}
        >
          <IconShare />
        </button>

        <div className="volume hide-mobile">
          <button
            type="button"
            className="icon-action"
            onClick={player.toggleMute}
            aria-label={t('volume')}
          >
            {player.muted ? <IconVolumeOff /> : <IconVolume />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={player.volume}
            onChange={(event) => player.setVolume(Number(event.target.value))}
            aria-label={t('volume')}
          />
        </div>

        <div className="sleep-wrap">
          <button
            type="button"
            className={`icon-action sleep-trigger ${player.sleepMinutes != null ? 'on' : ''}`}
            onClick={() => setSleepOpen((open) => !open)}
            aria-label={t('sleep')}
            aria-expanded={sleepOpen}
          >
            <IconMoon />
            {player.sleepRemaining != null && (
              <span className="sleep-badge mono">{player.sleepRemaining}</span>
            )}
          </button>
          {sleepOpen && (
            <>
              <button
                type="button"
                className="menu-backdrop"
                aria-label={t('close')}
                onClick={() => setSleepOpen(false)}
              />
              <div className="sleep-menu" role="menu">
                <div className="sleep-menu-title">{t('sleep')}</div>
                <button
                  type="button"
                  className={player.sleepMinutes == null ? 'on' : ''}
                  onClick={() => {
                    player.setSleep(null);
                    setSleepOpen(false);
                  }}
                >
                  {t('sleepOff')}
                </button>
                {[15, 30, 60].map((minutes) => (
                  <button
                    type="button"
                    key={minutes}
                    className={player.sleepMinutes === minutes ? 'on' : ''}
                    onClick={() => {
                      player.setSleep(minutes);
                      setSleepOpen(false);
                    }}
                  >
                    {t('sleepMinutes', { n: minutes })}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
