import { useCallback, useEffect, useRef, useState } from 'react';
import type { Station } from '../data/types';

interface HlsLike {
  destroy(): void;
}

export interface PlayerOptions {
  pickNext: (excludeId?: string) => Station | null;
  onError?: (message: string) => void;
}

export interface PlayerApi {
  station: Station | null;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  error: string | null;
  sleepMinutes: number | null;
  sleepRemaining: number | null;
  playStation: (station: Station) => void;
  toggle: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  canPrevious: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setSleep: (minutes: number | null) => void;
}

const STALL_MS = 8500;
const START_MS = 13_000;

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem('fm360.volume');
    if (raw == null) return 0.8;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
  } catch {
    // ignore
  }
  return 0.8;
}

export function usePlayer({ pickNext, onError }: PlayerOptions): PlayerApi {
  const [station, setStation] = useState<Station | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sleepMinutes, setSleepMinutesState] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [canPrevious, setCanPrevious] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<HlsLike | null>(null);
  const stationRef = useRef<Station | null>(null);
  const historyRef = useRef<Station[]>([]);
  const urlsRef = useRef<string[]>([]);
  const urlIndexRef = useRef(0);
  const tokenRef = useRef(0);
  const switchingRef = useRef(false);
  const failureGuardRef = useRef(false);
  const stallTimerRef = useRef<number | null>(null);
  const volumeRef = useRef(volume);
  const onErrorRef = useRef(onError);
  const pickNextRef = useRef(pickNext);
  const sleepEndRef = useRef(0);
  const sleepTickRef = useRef<number | null>(null);
  const fadeRef = useRef<number | null>(null);
  const nextRef = useRef<() => void>(() => {});

  onErrorRef.current = onError;
  pickNextRef.current = pickNext;
  volumeRef.current = volume;

  const clearStall = useCallback(() => {
    if (stallTimerRef.current != null) {
      window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        // ignore
      }
      hlsRef.current = null;
    }
  }, []);

  const startUrl = useCallback(() => {
    const audio = audioRef.current;
    const current = stationRef.current;
    if (!audio || !current) return;
    const url = urlsRef.current[urlIndexRef.current];
    if (!url) {
      setError('no-url');
      setIsPlaying(false);
      onErrorRef.current?.('no-url');
      return;
    }

    const token = ++tokenRef.current;
    destroyHls();
    clearStall();
    setError(null);
    switchingRef.current = true;
    audio.pause();
    audio.removeAttribute('src');
    try {
      audio.load();
    } catch {
      // ignore
    }

    const armStart = () => {
      clearStall();
      stallTimerRef.current = window.setTimeout(() => {
        if (token === tokenRef.current) handleFailure('start-timeout');
      }, START_MS);
    };

    const handleFailure = (reason: string) => {
      if (token !== tokenRef.current) return;
      if (failureGuardRef.current) return;
      failureGuardRef.current = true;
      window.setTimeout(() => {
        failureGuardRef.current = false;
      }, 400);
      clearStall();
      if (urlIndexRef.current + 1 < urlsRef.current.length) {
        urlIndexRef.current += 1;
        startUrl();
      } else {
        setIsPlaying(false);
        setError(reason);
        onErrorRef.current?.(reason);
      }
    };

    const play = () => {
      audio.play().catch((err: unknown) => {
        if (token !== tokenRef.current) return;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'AbortError') return;
        handleFailure(name || 'play-rejected');
      });
    };

    if (current.hls === 1 || /\.m3u8($|\?)/i.test(url)) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (token !== tokenRef.current) return;
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 30,
            });
            hlsRef.current = hls;
            hls.attachMedia(audio);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
              hls.loadSource(url);
            });
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (token === tokenRef.current) play();
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal && token === tokenRef.current) handleFailure('hls');
            });
            armStart();
          } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
            audio.src = url;
            audio.load();
            armStart();
            play();
          } else {
            handleFailure('hls-unsupported');
          }
        })
        .catch(() => {
          if (token === tokenRef.current) handleFailure('hls-load');
        });
    } else {
      audio.src = url;
      audio.load();
      armStart();
      play();
    }

    window.setTimeout(() => {
      switchingRef.current = false;
    }, 0);
  }, [clearStall, destroyHls]);

  const startStation = useCallback(
    (nextStation: Station, remember: boolean) => {
      const audio = audioRef.current;
      if (!audio) return;
      const current = stationRef.current;
      if (remember && current && current.id !== nextStation.id) {
        historyRef.current = [
          ...historyRef.current.filter((item) => item.id !== current.id),
          current,
        ].slice(-30);
      }
      setCanPrevious(historyRef.current.length > 0);
      stationRef.current = nextStation;
      setStation(nextStation);
      const urls = (nextStation.urls ?? []).filter(Boolean);
      urlsRef.current = urls;
      urlIndexRef.current = 0;
      if (!urls.length) {
        setError('no-url');
        setIsPlaying(false);
        onErrorRef.current?.('no-url');
        return;
      }
      startUrl();
      updateMediaSession(nextStation);
    },
    [startUrl],
  );

  const playStation = useCallback(
    (nextStation: Station) => startStation(nextStation, true),
    [startStation],
  );

  const previous = useCallback(() => {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev) return;
    historyRef.current = historyRef.current.slice(0, -1);
    setCanPrevious(historyRef.current.length > 0);
    startStation(prev, false);
  }, [startStation]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    clearStall();
  }, [clearStall]);

  const stop = useCallback(() => {
    clearStall();
    destroyHls();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      try {
        audio.load();
      } catch {
        // ignore
      }
    }
    stationRef.current = null;
    historyRef.current = [];
    setCanPrevious(false);
    setStation(null);
    setIsPlaying(false);
    setError(null);
  }, [clearStall, destroyHls]);

  const next = useCallback(() => {
    const nextStation = pickNextRef.current(stationRef.current?.id);
    if (!nextStation) {
      onErrorRef.current?.('no-stations');
      return;
    }
    playStation(nextStation);
  }, [playStation]);

  nextRef.current = next;
  const previousRef = useRef<() => void>(() => {});
  previousRef.current = previous;

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!stationRef.current) {
      next();
      return;
    }
    if (audio.paused) {
      audio.play().catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError') {
          onErrorRef.current?.('gesture');
        }
      });
    } else {
      audio.pause();
    }
  }, [next]);

  const setVolume = useCallback((value: number) => {
    const v = Math.max(0, Math.min(1, value));
    setVolumeState(v);
    volumeRef.current = v;
    const audio = audioRef.current;
    if (audio) {
      audio.volume = v;
      if (v > 0 && audio.muted) {
        audio.muted = false;
        setMuted(false);
      }
    }
    try {
      localStorage.setItem('fm360.volume', String(v));
    } catch {
      // ignore
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }, []);

  const clearSleepTimers = useCallback(() => {
    if (sleepTickRef.current != null) {
      window.clearInterval(sleepTickRef.current);
      sleepTickRef.current = null;
    }
    if (fadeRef.current != null) {
      window.clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  }, []);

  const setSleep = useCallback(
    (minutes: number | null) => {
      clearSleepTimers();
      const audio = audioRef.current;
      if (audio) audio.volume = volumeRef.current;
      if (minutes == null) {
        setSleepMinutesState(null);
        setSleepRemaining(null);
        sleepEndRef.current = 0;
        return;
      }
      setSleepMinutesState(minutes);
      setSleepRemaining(minutes);
      sleepEndRef.current = Date.now() + minutes * 60_000;
      sleepTickRef.current = window.setInterval(() => {
        const remaining = sleepEndRef.current - Date.now();
        if (remaining > 0) {
          setSleepRemaining(Math.max(1, Math.ceil(remaining / 60_000)));
          return;
        }
        if (sleepTickRef.current != null) {
          window.clearInterval(sleepTickRef.current);
          sleepTickRef.current = null;
        }
        setSleepRemaining(0);
        if (fadeRef.current != null) window.clearInterval(fadeRef.current);
        const startVolume = volumeRef.current;
        const startedAt = Date.now();
        fadeRef.current = window.setInterval(() => {
          const elapsed = Date.now() - startedAt;
          const ratio = Math.max(0, 1 - elapsed / 9000);
          const currentAudio = audioRef.current;
          if (currentAudio) currentAudio.volume = startVolume * ratio;
          if (ratio <= 0) {
            if (fadeRef.current != null) {
              window.clearInterval(fadeRef.current);
              fadeRef.current = null;
            }
            currentAudio?.pause();
            if (currentAudio) currentAudio.volume = startVolume;
            setSleepMinutesState(null);
            setSleepRemaining(null);
          }
        }, 200);
      }, 1000);
    },
    [clearSleepTimers],
  );

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = volumeRef.current;
    audioRef.current = audio;
    (window as unknown as { __fm360Audio?: HTMLAudioElement }).__fm360Audio = audio;

    const onPlaying = () => {
      setIsPlaying(true);
      setError(null);
      clearStall();
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => {
      if (stallTimerRef.current != null) return;
      stallTimerRef.current = window.setTimeout(() => {
        if (audioRef.current && !audioRef.current.paused) {
          // Let the start timeout/URL failover handle reloads.
          const current = stationRef.current;
          if (current) {
            urlIndexRef.current = Math.min(
              urlIndexRef.current + 1,
              Math.max(0, urlsRef.current.length - 1),
            );
            startUrl();
          }
        }
      }, STALL_MS);
    };
    const onError = () => {
      if (switchingRef.current) return;
      if (!audio.src) return;
      // The URL-level failover is handled by startUrl's timeout as well;
      // this catches immediate decode/network errors.
      if (urlIndexRef.current + 1 < urlsRef.current.length) {
        urlIndexRef.current += 1;
        startUrl();
      } else {
        setIsPlaying(false);
        setError('stream-error');
        onErrorRef.current?.('stream-error');
      }
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onWaiting);
    audio.addEventListener('error', onError);

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          audio.play().catch(() => undefined);
        });
        navigator.mediaSession.setActionHandler('pause', () => audio.pause());
        navigator.mediaSession.setActionHandler('stop', () => stop());
        navigator.mediaSession.setActionHandler('nexttrack', () => nextRef.current());
        navigator.mediaSession.setActionHandler('previoustrack', () => previousRef.current());
      } catch {
        // Some browsers do not support every action.
      }
    }

    return () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onWaiting);
      audio.removeEventListener('error', onError);
      clearSleepTimers();
      clearStall();
      destroyHls();
      audio.pause();
      audio.removeAttribute('src');
      audioRef.current = null;
      delete (window as unknown as { __fm360Audio?: HTMLAudioElement }).__fm360Audio;
    };
  }, [clearSleepTimers, clearStall, destroyHls, startUrl, stop]);

  return {
    station,
    isPlaying,
    volume,
    muted,
    error,
    sleepMinutes,
    sleepRemaining,
    playStation,
    toggle,
    pause,
    stop,
    next,
    previous,
    canPrevious,
    setVolume,
    toggleMute,
    setSleep,
  };
}

function updateMediaSession(station: Station): void {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  try {
    const artwork = station.favicon?.startsWith('https://')
      ? [{ src: station.favicon, sizes: '96x96' }]
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: station.country,
      album: 'fm360',
      artwork,
    });
  } catch {
    // ignore
  }
}
