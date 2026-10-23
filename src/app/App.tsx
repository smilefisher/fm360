import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilterBar } from '../components/FilterBar';
import { HoverCard } from '../components/HoverCard';
import { Intro } from '../components/Intro';
import { Logo } from '../components/Logo';
import { PlayerDock } from '../components/PlayerDock';
import { SearchOverlay } from '../components/SearchOverlay';
import { SkyLabels } from '../components/SkyLabels';
import { StationSheet } from '../components/StationSheet';
import { Toast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import {
  detectedRegion,
  regionOfStation,
  type RegionPref,
} from '../data/regions';
import type { SeedPayload, Station, ViewMode } from '../data/types';
import { GlobeCanvas } from '../globe/GlobeCanvas';
import { useI18n } from '../i18n';
import { usePlayer } from '../player/usePlayer';
import { NIGHT, applyTheme } from '../themes/night';
import {
  copyText,
  hasSeen,
  markSeen,
  readSaved,
  stationShareUrl,
  useNow,
  writeSaved,
} from '../utils';

const QUERY = (() => {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
})();

const SHARED_ID = QUERY.get('s');
const NO_INTRO = QUERY.has('nointro');
const INITIAL_MODE: ViewMode = QUERY.get('view') === 'sky' ? 'sky' : 'globe';

interface HoverState {
  station: Station;
  x: number;
  y: number;
}

export function App() {
  const { t, lang, setLang } = useI18n();
  const [payload, setPayload] = useState<SeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>(INITIAL_MODE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [region, setRegion] = useState<RegionPref>('auto');
  const [activeGenres, setActiveGenres] = useState<Set<string>>(() => new Set());
  const [onlyPlayable, setOnlyPlayable] = useState(true);
  const [saved, setSaved] = useState<Set<string>>(readSaved);
  const [showIntro, setShowIntro] = useState(() => !NO_INTRO && !hasSeen() && !SHARED_ID);
  const [toast, setToast] = useState<string | null>(null);
  const [focusStation, setFocusStation] = useState<Station | null>(null);
  const recentRef = useRef<string[]>([]);
  const now = useNow();
  const detected = useMemo(() => detectedRegion(), []);

  useEffect(() => {
    applyTheme(NIGHT);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}seed.json`, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SeedPayload>;
      })
      .then((data) => {
        if (!alive) return;
        setPayload(data);
        setLoadError(null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setLoadError(error instanceof Error ? error.message : String(error));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!payload) return;
    const id = SHARED_ID;
    if (!id) return;
    const station = payload.stations.find((item) => item.id === id);
    if (!station) return;
    setSelectedId(station.id);
    setFocusStation(station);
    setShowIntro(false);
  }, [payload]);

  const stations = payload?.stations ?? [];

  const filtered = useMemo(() => {
    let list = stations;
    if (region !== 'auto' && region !== 'all') {
      list = list.filter((station) => regionOfStation(station) === region);
    }
    if (activeGenres.size > 0) {
      list = list.filter((station) => activeGenres.has(station.genre));
    }
    if (onlyPlayable) {
      list = list.filter((station) => station.urls.length > 0);
    }
    return list;
  }, [stations, region, activeGenres, onlyPlayable]);

  const matchIds = useMemo(() => {
    if (!payload || filtered.length === stations.length) return null;
    return new Set(filtered.map((station) => station.id));
  }, [payload, filtered, stations.length]);

  const pickNext = useCallback(
    (excludeId?: string) => {
      const pool = filtered.filter(
        (station) => station.urls.length > 0 && station.id !== excludeId,
      );
      if (!pool.length) return null;

      let candidates = pool;
      if (region === 'auto') {
        const local = pool.filter((station) => regionOfStation(station) === detected);
        if (local.length > 0 && Math.random() < 0.7) candidates = local;
      }

      const recent = recentRef.current;
      const fresh = candidates.filter((station) => !recent.includes(station.id));
      if (fresh.length >= Math.min(5, candidates.length)) candidates = fresh;

      const weights = candidates.map((station) => {
        const popularity = Math.log1p(Math.max(0, station.pop)) + 1;
        const health = station.health == null ? 0.75 : Math.max(0.15, station.health / 100);
        return popularity * health;
      });
      const total = weights.reduce((sum, value) => sum + value, 0);
      let cursor = Math.random() * total;
      let chosen = candidates[candidates.length - 1];
      for (let i = 0; i < candidates.length; i++) {
        cursor -= weights[i];
        if (cursor <= 0) {
          chosen = candidates[i];
          break;
        }
      }
      recentRef.current = [chosen.id, ...recent].slice(0, 8);
      return chosen;
    },
    [filtered, region, detected],
  );

  const showToast = useCallback((message: string) => setToast(message), []);

  const player = usePlayer({
    pickNext,
    onError: () => showToast(t('playFailed')),
  });

  useEffect(() => {
    document.title = player.station
      ? `${player.station.name} · fm360`
      : 'fm360 — 随机一站，听见世界';
  }, [player.station]);

  useEffect(() => {
    (window as unknown as { __fm360?: unknown }).__fm360 = {
      player,
      stations,
      mode,
      selectedId,
    };
  }, [player, stations, mode, selectedId]);

  const toggleSave = useCallback((station: Station) => {
    setSaved((previous) => {
      const next = new Set(previous);
      if (next.has(station.id)) next.delete(station.id);
      else next.add(station.id);
      writeSaved(next);
      return next;
    });
  }, []);

  const startStation = useCallback(
    (station: Station) => {
      setSelectedId(station.id);
      player.playStation(station);
      markSeen();
      setShowIntro(false);
    },
    [player],
  );

  const playFromSearch = useCallback(
    (station: Station) => {
      setMode('globe');
      setSelectedId(station.id);
      setFocusStation(station);
      player.playStation(station);
      markSeen();
      setShowIntro(false);
      setSearchOpen(false);
    },
    [player],
  );

  const onIntroStart = useCallback(() => {
    const station = pickNext();
    if (!station) {
      showToast(t('noStations'));
      return;
    }
    markSeen();
    setShowIntro(false);
    setMode('globe');
    setSelectedId(station.id);
    setFocusStation(station);
    player.playStation(station);
  }, [pickNext, player, showToast, t]);

  const shareStation = useCallback(
    async (station: Station) => {
      const ok = await copyText(stationShareUrl(station));
      showToast(ok ? t('copied') : t('copyFail'));
    },
    [showToast, t],
  );

  const selectedStation = useMemo(
    () => (selectedId ? stations.find((station) => station.id === selectedId) ?? null : null),
    [selectedId, stations],
  );

  const { toggle: togglePlayback, next: nextStation, previous: previousStation } = player;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (isTyping) return;
      if (event.key === '/') {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setSelectedId(null);
        setHover(null);
        return;
      }
      const interactive = !!target?.closest(
        'button, a, select, input, textarea, [role="button"]',
      );
      if (event.code === 'Space' && !interactive) {
        event.preventDefault();
        togglePlayback();
      } else if (!interactive && event.key.toLowerCase() === 'n') {
        nextStation();
      } else if (!interactive && event.key.toLowerCase() === 'p') {
        previousStation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlayback, nextStation, previousStation]);

  if (loadError) {
    return (
      <div className="app load-error-app">
        <div className="load-error">
          <Logo />
          <h2>{t('loadFail')}</h2>
          <p>{t('loadHint')}</p>
          <span className="mono">{loadError}</span>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  const showChrome = !showIntro;

  return (
    <div className={`app mode-${mode} ${showIntro ? 'has-intro' : ''}`}>
      <GlobeCanvas
        stations={stations}
        theme={NIGHT}
        mode={mode}
        selectedId={selectedId}
        hoveredId={hover?.station.id ?? null}
        matchIds={matchIds}
        focusStation={focusStation}
        onHover={(station, x, y) => setHover(station ? { station, x, y } : null)}
        onSelect={(station) => {
          setSelectedId(station?.id ?? null);
          if (station) setHover(null);
        }}
        onPlay={startStation}
      />
      <div className="atmosphere" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="aurora" aria-hidden="true" />

      {showChrome && (
        <>
          <TopBar
            mode={mode}
            onMode={(nextMode) => {
              setMode(nextMode);
              setSelectedId(null);
              setHover(null);
              setFocusStation(null);
            }}
            onSearch={() => setSearchOpen(true)}
            lang={lang}
            onLang={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            demo={payload?.demo}
          />

          <div className={`view-hint ${mode}`}>
            {mode === 'globe' ? t('globeHint') : t('skyHint')}
          </div>

          {mode === 'sky' && (
            <SkyLabels stations={stations} activeGenres={activeGenres} />
          )}

          {selectedStation && (
            <StationSheet
              station={selectedStation}
              isPlaying={player.station?.id === selectedStation.id && player.isPlaying}
              saved={saved.has(selectedStation.id)}
              onClose={() => setSelectedId(null)}
              onPlay={() => {
                if (player.station?.id === selectedStation.id) player.toggle();
                else startStation(selectedStation);
              }}
              onToggleSave={() => toggleSave(selectedStation)}
              onShare={() => {
                void shareStation(selectedStation);
              }}
              now={now}
            />
          )}

          <div className="bottom-stack">
            <FilterBar
              region={region}
              onRegion={setRegion}
              activeGenres={activeGenres}
              onToggleGenre={(genre) => {
                setActiveGenres((previous) => {
                  const next = new Set(previous);
                  if (next.has(genre)) next.delete(genre);
                  else next.add(genre);
                  return next;
                });
              }}
              onClearGenres={() => setActiveGenres(new Set())}
              onlyPlayable={onlyPlayable}
              onTogglePlayable={() => setOnlyPlayable((value) => !value)}
              detected={detected}
              count={filtered.length}
            />
            <PlayerDock
              player={player}
              station={player.station}
              saved={player.station ? saved.has(player.station.id) : false}
              onToggleSave={() => {
                if (player.station) toggleSave(player.station);
              }}
              onOpen={() => {
                if (player.station) setSelectedId(player.station.id);
              }}
              onShare={() => {
                if (player.station) void shareStation(player.station);
              }}
              now={now}
            />
          </div>
        </>
      )}

      {showIntro && (
        <Intro
          loading={loading}
          countries={payload?.counts.countries ?? 0}
          stations={stations.length}
          onStart={onIntroStart}
          onExplore={() => {
            markSeen();
            setShowIntro(false);
          }}
        />
      )}

      {showChrome && (
        <HoverCard
          station={hover?.station ?? null}
          x={hover?.x ?? 0}
          y={hover?.y ?? 0}
          now={now}
        />
      )}

      {showChrome && (
        <SearchOverlay
          open={searchOpen}
          stations={stations}
          onClose={() => setSearchOpen(false)}
          onPlay={playFromSearch}
          now={now}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
