export type GenreId =
  | 'pop'
  | 'rock'
  | 'electronic'
  | 'jazz'
  | 'classical'
  | 'news'
  | 'hiphop'
  | 'country'
  | 'world'
  | 'religious'
  | 'ambient'
  | 'oldies'
  | 'mixed';

export interface Station {
  id: string;
  name: string;
  urls: string[];
  cc: string;
  country: string;
  lat: number;
  lng: number;
  precision: number;
  tz: string;
  genre: string;
  lang: string;
  bitrate: number;
  codec: string;
  hls: number;
  pop: number;
  votes: number;
  tags: string;
  homepage: string;
  favicon: string;
  health: number | null;
  checkedAt: number | null;
}

export interface SeedPayload {
  v: number;
  demo?: boolean;
  source: string;
  sourceUrl?: string;
  builtAt: string;
  counts: {
    total: number;
    countries: number;
    genres: number;
    rejected?: number;
  };
  genres: string[];
  stations: Station[];
}

export type ViewMode = 'globe' | 'sky';
