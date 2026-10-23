/**
 * Local bootstrap seed for the visual prototype.
 *
 * This is deliberately NOT the production pipeline. It fetches a popular slice
 * from Radio Browser, normalizes it into the same shape the real build will
 * publish, and writes public/seed.json. The Worker Cron pipeline arrives in M1.
 *
 * Run: pnpm seed
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import tzLookup from 'tz-lookup';
import countries from 'world-countries';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'seed.json');
const MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://all.api.radio-browser.info',
];

// A popular slice keeps the good stations; a random slice fills out the map
// with stations from smaller countries. Together they make the visual
// prototype look like the real ~35k dataset.
const FETCHES = [
  {
    name: 'popular',
    cache: '/tmp/fm360-rb-popular.json',
    query: 'limit=12000&order=clickcount&reverse=true',
  },
  {
    name: 'random',
    cache: '/tmp/fm360-rb-random.json',
    query: 'limit=12000&order=random',
  },
];

const GENRES = [
  'pop',
  'rock',
  'electronic',
  'jazz',
  'classical',
  'news',
  'hiphop',
  'country',
  'world',
  'religious',
  'ambient',
  'oldies',
  'mixed',
];

const GENRE_WORDS = {
  news: [
    'news', 'talk', 'information', 'info', 'actualité', 'actualite', 'noticias',
    'nachrichten', 'journal', 'debate', 'sport', 'sports', 'politic', 'politique',
  ],
  classical: [
    'classical', 'classique', 'klassik', 'clásica', 'clasica', 'opera', 'opéra',
    'symphony', 'symphonic', 'baroque', 'chamber', 'orchestra', 'philharmonic',
  ],
  jazz: ['jazz', 'blues', 'swing', 'ragtime', 'bebop', 'soul', 'funk'],
  electronic: [
    'electronic', 'electronica', 'techno', 'house', 'trance', 'dance', 'edm',
    'club', 'drum and bass', 'dnb', 'dubstep', 'synth', 'electro',
  ],
  rock: ['rock', 'metal', 'punk', 'alternative', 'indie', 'grunge', 'hardcore'],
  pop: ['pop', 'hits', 'top 40', 'top40', 'chart', 'chartshow', 'charts'],
  hiphop: ['hip hop', 'hip-hop', 'hiphop', 'rap', 'r&b', 'rnb', 'urban', 'trap'],
  country: ['country', 'folk', 'bluegrass', 'americana', 'western'],
  world: [
    'world', 'latin', 'salsa', 'reggae', 'afro', 'bollywood', 'arabic',
    'chinese', 'japanese', 'korean', 'greek', 'turkish', 'indian', 'local',
    'regional', 'international', 'varied', 'variety',
  ],
  religious: [
    'gospel', 'religious', 'religion', 'christian', 'catholic', 'islam',
    'quran', 'qur’an', 'buddhist', 'jewish', 'spiritual', 'church',
  ],
  ambient: [
    'ambient', 'chill', 'chillout', 'lounge', 'easy listening', 'relax',
    'relaxation', 'sleep', 'meditation', 'downtempo',
  ],
  oldies: ['oldies', 'retro', '60s', '70s', '80s', '90s', 'classic hits', 'nostalgia'],
};

const ISO3_TO_ISO1 = {
  eng: 'en', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de', spa: 'es', ita: 'it',
  por: 'pt', rus: 'ru', tur: 'tr', ara: 'ar', hin: 'hi', nld: 'nl', dut: 'nl',
  pol: 'pl', ukr: 'uk', ron: 'ro', rum: 'ro', ell: 'el', gre: 'el', ces: 'cs',
  cze: 'cs', swe: 'sv', nor: 'no', dan: 'da', fin: 'fi', jpn: 'ja', kor: 'ko',
  zho: 'zh', chi: 'zh', cmn: 'zh', yue: 'zh', cat: 'ca', hrv: 'hr', srp: 'sr',
  bul: 'bg', heb: 'he', fas: 'fa', per: 'fa', urd: 'ur', ben: 'bn', ind: 'id',
  msa: 'ms', may: 'ms', tha: 'th', vie: 'vi', swe: 'sv', slk: 'sk', slo: 'sk',
  slv: 'sl', lit: 'lt', lav: 'lv', est: 'et', isl: 'is', gle: 'ga', cym: 'cy',
  eus: 'eu', baq: 'eu', glg: 'gl', mkd: 'mk', sqi: 'sq', alb: 'sq', hye: 'hy',
  arm: 'hy', kat: 'ka', geo: 'ka', aze: 'az', kaz: 'kk', uzb: 'uz', kir: 'ky',
  tgk: 'tg', tuk: 'tk', mon: 'mn', nep: 'ne', sin: 'si', tam: 'ta', tel: 'te',
  mar: 'mr', guj: 'gu', pan: 'pa', mal: 'ml', kan: 'kn', ori: 'or', asm: 'as',
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function jitter(id, amount) {
  const n = hash(id);
  return (((n & 0xffff) / 0xffff) * 2 - 1) * amount;
}

function cleanName(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|•·]+|[\s\-–—|•·]+$/g, '')
    .trim();
}

function normalizeUrl(s) {
  try {
    const u = new URL(String(s).trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    u.hash = '';
    return u.toString();
  } catch {
    return '';
  }
}

function urlKey(s) {
  try {
    const u = new URL(s);
    u.hash = '';
    u.search = '';
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return s;
  }
}

function classify(tags, name) {
  const text = `${String(tags || '')} ${String(name || '')}`.toLowerCase();
  let best = 'mixed';
  let bestScore = 0;
  for (const [genre, words] of Object.entries(GENRE_WORDS)) {
    let score = 0;
    for (const word of words) {
      if (text.includes(word)) score += word.length > 5 ? 2 : 1;
    }
    if (score > bestScore) {
      best = genre;
      bestScore = score;
    }
  }
  return best;
}

function languageOf(station) {
  const raw = String(station.languagecodes || '').split(',')[0].trim().toLowerCase();
  if (raw) {
    const code = raw.length === 3 ? ISO3_TO_ISO1[raw] || raw : raw;
    return code;
  }
  const name = String(station.language || '').split(',')[0].trim();
  return name;
}

function countryOf(station) {
  const cc = String(station.countrycode || '').trim().toUpperCase();
  if (!cc) return null;
  const c = countries.find((x) => x.cca2 === cc);
  if (!c?.latlng) return { cc, name: station.country || cc, lat: null, lng: null };
  return {
    cc,
    name: station.country || c.name?.common || cc,
    lat: c.latlng[0],
    lng: c.latlng[1],
  };
}

function timezoneOf(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Etc/UTC';
  try {
    return tzLookup(lat, lng);
  } catch {
    return 'Etc/UTC';
  }
}

async function fetchSet({ name, cache, query }) {
  if (existsSync(cache)) {
    const cached = JSON.parse(await readFile(cache, 'utf8'));
    if (Array.isArray(cached) && cached.length > 100) {
      console.log(`using cached ${name} sample (${cached.length})`);
      return cached;
    }
  }
  let lastError = null;
  for (const mirror of MIRRORS) {
    try {
      const url = `${mirror}/json/stations/search?${query}&hidebroken=true&lastcheckok=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'fm360-seed/0.1 (+https://fm360.toolora.stream)' },
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('not an array');
      await writeFile(cache, JSON.stringify(data));
      console.log(`fetched ${data.length} ${name} stations from ${mirror}`);
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`mirror failed: ${mirror}: ${error.message}`);
    }
  }
  throw lastError || new Error(`Radio Browser unavailable (${name})`);
}

async function fetchStations() {
  const all = [];
  for (const request of FETCHES) {
    all.push(...(await fetchSet(request)));
  }
  console.log(`combined ${all.length} stations before filtering`);
  return all;
}

function normalize(raw) {
  const name = cleanName(raw.name);
  if (!name) return null;

  const urls = [];
  for (const candidate of [raw.url_resolved, raw.url]) {
    const u = normalizeUrl(candidate);
    if (u && u.startsWith('https://') && !urls.some((x) => urlKey(x) === urlKey(u))) {
      urls.push(u);
    }
  }
  if (!urls.length) return null;

  const country = countryOf(raw);
  if (!country) return null;

  let lat = Number(raw.geo_lat);
  let lng = Number(raw.geo_long);
  let precision = 2;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    if (country.lat == null || country.lng == null) return null;
    lat = country.lat + jitter(raw.stationuuid, 0.9);
    lng = country.lng + jitter(`${raw.stationuuid}:lng`, 0.9);
    precision = 0;
  }

  const bitrate = Number(raw.bitrate);
  const safeBitrate = Number.isFinite(bitrate) && bitrate > 0 && bitrate <= 512 ? Math.round(bitrate) : 0;
  const hls = Number(raw.hls) === 1 || /\.m3u8($|\?)/i.test(urls[0]) ? 1 : 0;
  const genre = classify(raw.tags, name);
  const lang = languageOf(raw);

  return {
    id: raw.stationuuid,
    name,
    urls: urls.slice(0, 3),
    cc: country.cc,
    country: country.name,
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    precision,
    tz: timezoneOf(lat, lng),
    genre,
    lang,
    bitrate: safeBitrate,
    codec: String(raw.codec || '').trim() || 'UNKNOWN',
    hls,
    pop: Number(raw.clickcount) || 0,
    votes: Number(raw.votes) || 0,
    tags: String(raw.tags || '').trim(),
    homepage: normalizeUrl(raw.homepage) || '',
    favicon: normalizeUrl(raw.favicon) || '',
    health: null,
    checkedAt: null,
  };
}

async function main() {
  const raw = await fetchStations();
  const byUrl = new Map();
  const byName = new Map();
  let rejected = 0;

  for (const station of raw) {
    const item = normalize(station);
    if (!item) {
      rejected++;
      continue;
    }
    const uKey = urlKey(item.urls[0]);
    const nKey = `${item.name.toLowerCase()}|${item.cc}`;
    const existingUrl = byUrl.get(uKey);
    const existingName = byName.get(nKey);
    const existing = existingUrl || existingName;
    if (existing) {
      if ((item.votes || 0) > (existing.votes || 0)) {
        byUrl.delete(urlKey(existing.urls[0]));
        byName.delete(`${existing.name.toLowerCase()}|${existing.cc}`);
      } else {
        // Keep the existing one, but preserve a useful alternate stream.
        if (!existing.urls.some((u) => urlKey(u) === uKey) && existing.urls.length < 3) {
          existing.urls.push(item.urls[0]);
        }
        continue;
      }
    }
    byUrl.set(uKey, item);
    byName.set(nKey, item);
  }

  const stations = [...byUrl.values()].sort((a, b) => b.pop - a.pop);
  const now = new Date();
  const payload = {
    v: 1,
    demo: true,
    source: 'Radio Browser · popular sample',
    sourceUrl: 'https://www.radio-browser.info/',
    builtAt: now.toISOString(),
    counts: {
      total: stations.length,
      countries: new Set(stations.map((s) => s.cc)).size,
      genres: new Set(stations.map((s) => s.genre)).size,
      rejected,
    },
    genres: GENRES,
    stations,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload));
  console.log(
    `wrote ${stations.length} stations, ${payload.counts.countries} countries, ` +
      `${payload.counts.genres} genres → ${OUT} (${(JSON.stringify(payload).length / 1024 / 1024).toFixed(2)} MB)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
