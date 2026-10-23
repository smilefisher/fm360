import type { GenreId } from './types';

export interface GenreMeta {
  zh: string;
  en: string;
  color: string;
}

export const GENRES: Record<GenreId, GenreMeta> = {
  pop: { zh: '流行', en: 'Pop', color: '#ff8a65' },
  rock: { zh: '摇滚', en: 'Rock', color: '#ffb454' },
  electronic: { zh: '电子', en: 'Electronic', color: '#5eead4' },
  jazz: { zh: '爵士蓝调', en: 'Jazz & Blues', color: '#a78bfa' },
  classical: { zh: '古典', en: 'Classical', color: '#fde68a' },
  news: { zh: '新闻谈话', en: 'News & Talk', color: '#7dd3fc' },
  hiphop: { zh: '嘻哈', en: 'Hip-hop', color: '#f472b6' },
  country: { zh: '乡村民谣', en: 'Country & Folk', color: '#86efac' },
  world: { zh: '地方与世界', en: 'Local & World', color: '#2dd4bf' },
  religious: { zh: '宗教', en: 'Religious', color: '#c4b5fd' },
  ambient: { zh: '氛围与放松', en: 'Ambient & Chill', color: '#a5f3fc' },
  oldies: { zh: '怀旧', en: 'Oldies', color: '#fb923c' },
  mixed: { zh: '综合', en: 'Mixed', color: '#e2e8f0' },
};

export const GENRE_IDS = Object.keys(GENRES) as GenreId[];

export function genreMeta(id: string): GenreMeta {
  return GENRES[id as GenreId] ?? GENRES.mixed;
}

export function genreColor(id: string): string {
  return genreMeta(id).color;
}

export function genreLabel(id: string, lang: 'zh' | 'en'): string {
  return genreMeta(id)[lang];
}
