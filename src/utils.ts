import { useEffect, useState } from 'react';
import { genreLabel } from './data/genres';
import { regionLabel, regionOfStation } from './data/regions';
import type { Station } from './data/types';
import type { Lang } from './i18n';

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function approxOffsetHours(station: Station): number {
  return Math.round(station.lng / 15);
}

export function approxLocalTime(station: Station, now = new Date()): string {
  const d = new Date(now.getTime() + approxOffsetHours(station) * 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function stationLocalTime(station: Station, lang: Lang, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-GB', {
      timeZone: station.tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    return approxLocalTime(station, now);
  }
}

export function stationLocalHour(station: Station, now = new Date()): number {
  try {
    const text = new Intl.DateTimeFormat('en-GB', {
      timeZone: station.tz,
      hour: '2-digit',
      hour12: false,
    }).format(now);
    const hour = Number.parseInt(text, 10);
    return Number.isFinite(hour) ? hour : 12;
  } catch {
    const d = new Date(now.getTime() + approxOffsetHours(station) * 3_600_000);
    return d.getUTCHours();
  }
}

export type DayPeriod = 'morning' | 'day' | 'evening' | 'night';

export function periodOfHour(hour: number): DayPeriod {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function countryName(cc: string, lang: Lang, fallback = ''): string {
  try {
    const names = new Intl.DisplayNames([lang === 'zh' ? 'zh-CN' : 'en'], { type: 'region' });
    return names.of(cc.toUpperCase()) || fallback || cc;
  } catch {
    return fallback || cc;
  }
}

export function languageName(code: string, lang: Lang, fallback = ''): string {
  if (!code) return fallback;
  try {
    const names = new Intl.DisplayNames([lang === 'zh' ? 'zh-CN' : 'en'], { type: 'language' });
    return names.of(code) || fallback || code;
  } catch {
    return fallback || code;
  }
}

export function formatNumber(value: number, lang: Lang): string {
  try {
    return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en').format(value);
  } catch {
    return String(value);
  }
}

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function stationMatches(station: Station, query: string, lang: Lang): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = [
    station.name,
    station.country,
    station.cc,
    station.lang,
    station.tags,
    genreLabel(station.genre, lang),
    regionLabel(regionOfStation(station), lang),
  ]
    .map(normalizeSearch)
    .join(' ');
  return q.split(/\s+/).every((part) => haystack.includes(part));
}

export function stationShareUrl(station: Station): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('s', station.id);
  return url.toString();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function readSaved(): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem('fm360.saved') || '[]');
    if (Array.isArray(value)) return new Set(value.filter((x) => typeof x === 'string'));
  } catch {
    // ignore
  }
  return new Set();
}

export function writeSaved(saved: Set<string>): void {
  try {
    localStorage.setItem('fm360.saved', JSON.stringify([...saved]));
  } catch {
    // ignore
  }
}

export function markSeen(): void {
  try {
    localStorage.setItem('fm360.seen', '1');
  } catch {
    // ignore
  }
}

export function hasSeen(): boolean {
  try {
    return localStorage.getItem('fm360.seen') === '1';
  } catch {
    return false;
  }
}
