import { GENRES, type GenreMeta } from '../data/genres';
import type { GenreId } from '../data/types';

export type RGB = [number, number, number];

export interface WebglTheme {
  oceanDay: RGB;
  oceanNight: RGB;
  landDay: RGB;
  landNight: RGB;
  mapLandDay: RGB;
  mapLandNight: RGB;
  mapBorderDay: RGB;
  mapBorderNight: RGB;
  mapGrid: RGB;
  terminator: RGB;
  star: RGB;
  accent: RGB;
  genre: Record<string, RGB>;
}

export interface Theme {
  id: string;
  name: { zh: string; en: string };
  css: Record<string, string>;
  webgl: WebglTheme;
}

export function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = Number.parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const genre: Record<string, RGB> = {};
for (const id of Object.keys(GENRES) as GenreId[]) {
  genre[id] = hexToRgb(GENRES[id].color);
}

export const NIGHT: Theme = {
  id: 'night',
  name: { zh: '夜航', en: 'Night Flight' },
  css: {
    'bg': '#050b14',
    'bg-2': '#08131c',
    'ink': '#f4efe6',
    'ink-dark': '#172d2a',
    'dim': '#94a8b4',
    'faint': 'rgba(244,239,230,0.10)',
    'line': 'rgba(244,239,230,0.14)',
    'panel': 'rgba(7,18,27,0.72)',
    'panel-strong': 'rgba(8,21,31,0.92)',
    'accent': '#f5b544',
    'accent-2': '#6ee7b7',
    'coral': '#f36b45',
    'ocean': '#061820',
    'land': '#2b5b5a',
    'shadow': '0 24px 80px rgba(0,0,0,0.46)',
    'serif': '"Iowan Old Style", "Palatino Linotype", "Songti SC", "STSong", Georgia, serif',
    'sans': '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    'mono': '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace',
  },
  webgl: {
    oceanDay: hexToRgb('#0d3442'),
    oceanNight: hexToRgb('#031018'),
    landDay: hexToRgb('#3b7a70'),
    landNight: hexToRgb('#8ff0c4'),
    mapLandDay: hexToRgb('#2d7a6c'),
    mapLandNight: hexToRgb('#0f3a37'),
    mapBorderDay: hexToRgb('#8ff0c4'),
    mapBorderNight: hexToRgb('#3f8f83'),
    mapGrid: hexToRgb('#3b82f6'),
    terminator: hexToRgb('#ffb86b'),
    star: hexToRgb('#cfefff'),
    accent: hexToRgb('#f5b544'),
    genre,
  },
};

export const THEMES: Record<string, Theme> = { night: NIGHT };

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.css)) {
    root.style.setProperty(`--${key}`, value);
  }
  root.dataset.theme = theme.id;
}

export function genreColors(theme: Theme): RGB[] {
  return Object.keys(GENRES).map((id) => theme.webgl.genre[id] ?? theme.webgl.genre.mixed);
}

export function genreColorMap(theme: Theme): Record<string, RGB> {
  return theme.webgl.genre;
}

// Keep the imported type reachable for consumers that want to type a palette.
export type { GenreMeta };
