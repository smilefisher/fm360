import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { applySeo } from '../seo';

export type Lang = 'zh' | 'en';

const en = {
  pageTitle: 'fm360 — Listen somewhere new',
  tagline: 'Listen somewhere new.',
  sub: 'Press play. Leave the destination to chance.',
  introTitle: 'Listen\nsomewhere new.',
  introSub: 'Press play. Leave the destination to chance.',
  start: 'Start listening',
  explore: 'Explore the sky',
  loading: 'Loading stations…',
  loadFail: 'Could not load the station directory.',
  loadHint: 'Check your connection and try again.',
  retry: 'Retry',
  globe: 'Globe',
  sky: 'Sky',
  search: 'Search',
  searchPlaceholder: 'Search stations, countries, languages…',
  searchEmpty: 'No stations match that search.',
  searchHint: 'Try a country, city, language or genre.',
  results: '{n} results',
  region: 'Region',
  regionAuto: 'Auto · nearby first',
  regionAll: 'All regions',
  regionAsia: 'Asia',
  regionEurope: 'Europe',
  regionAmericas: 'Americas',
  regionAfrica: 'Africa',
  regionMiddleEast: 'Middle East',
  regionOceania: 'Oceania',
  regionOther: 'Other',
  genre: 'Genre',
  allGenres: 'All',
  onlyPlayable: 'Playable only',
  nowPlaying: 'Now playing',
  play: 'Play',
  pause: 'Pause',
  next: 'Next station',
  previous: 'Previous station',
  save: 'Save',
  saved: 'Saved',
  volume: 'Volume',
  sleep: 'Sleep timer',
  sleepOff: 'Off',
  sleepMinutes: '{n} min',
  sleepRemaining: 'Off in {n} min',
  live: 'Live',
  demo: 'Visual prototype · sample data',
  demoShort: 'Sample',
  unverified: 'Not probed yet',
  localTime: 'Local time',
  bitrate: 'Bitrate',
  codec: 'Codec',
  locationApprox: 'Country-level location',
  openHomepage: 'Station homepage',
  share: 'Copy link',
  copied: 'Link copied',
  copyFail: 'Could not copy the link',
  close: 'Close',
  stations: '{n} stations',
  countries: '{n} countries',
  source: 'Directory by Radio Browser',
  sourceNote: 'Audio streams directly from each station’s server.',
  language: 'Language',
  switchLang: '中文',
  playFailed: 'This station is not responding. Try the next one.',
  noStations: 'No playable stations.',
  loadingHint: 'First load downloads about 1 MB of station data.',
  view: 'View',
  globeHint: 'Drag to rotate · scroll to zoom',
  skyHint: 'Genre constellations · tap a star to listen',
  day: 'Day',
  night: 'Night',
  morning: 'Morning',
  evening: 'Evening',
  approxTime: 'Approx. local time',
  station: 'Station',
  stationsCount: '{n} stations',
  pressPlay: 'Press play',
  closeSearch: 'Close search',
  filter: 'Filter',
  clear: 'Clear',
  selected: 'Selected',
  introCredit: 'Station directory by Radio Browser · prototype sample',
  introStats: '{countries} countries · {stations} stations',
  theme: 'Theme',
  themeNight: 'Night Flight',
  keyboardHint: 'Press / to search',
};

type Dict = typeof en;

const zh: Dict = {
  pageTitle: 'fm360 — 随机一站，听见世界',
  tagline: '随机一站，听见世界。',
  sub: '按下播放，目的地交给运气。',
  introTitle: '随机一站，\n听见世界。',
  introSub: '按下播放，目的地交给运气。',
  start: '开始收听',
  explore: '先逛逛星图',
  loading: '正在载入电台…',
  loadFail: '电台数据载入失败。',
  loadHint: '检查网络后再试一次。',
  retry: '重试',
  globe: '地球',
  sky: '星座',
  search: '搜索',
  searchPlaceholder: '搜电台、国家、语言、风格…',
  searchEmpty: '没有找到匹配的电台。',
  searchHint: '试试国家、城市、语言或风格。',
  results: '{n} 个结果',
  region: '地区',
  regionAuto: '自动 · 本地区优先',
  regionAll: '全部地区',
  regionAsia: '亚洲',
  regionEurope: '欧洲',
  regionAmericas: '美洲',
  regionAfrica: '非洲',
  regionMiddleEast: '中东',
  regionOceania: '大洋洲',
  regionOther: '其他',
  genre: '风格',
  allGenres: '全部',
  onlyPlayable: '只看可播',
  nowPlaying: '正在收听',
  play: '播放',
  pause: '暂停',
  next: '下一站',
  previous: '上一站',
  save: '收藏',
  saved: '已收藏',
  volume: '音量',
  sleep: '定时关闭',
  sleepOff: '关闭',
  sleepMinutes: '{n} 分钟',
  sleepRemaining: '{n} 分钟后关闭',
  live: '直播',
  demo: '视觉原型 · 示例数据',
  demoShort: '示例',
  unverified: '尚未探测',
  localTime: '当地时间',
  bitrate: '码率',
  codec: '编码',
  locationApprox: '位置为国家近似',
  openHomepage: '电台主页',
  share: '复制分享链接',
  copied: '链接已复制',
  copyFail: '复制失败',
  close: '关闭',
  stations: '{n} 个电台',
  countries: '{n} 个国家/地区',
  source: '目录来自 Radio Browser',
  sourceNote: '声音直接来自各电台自己的服务器。',
  language: '语言',
  switchLang: 'English',
  playFailed: '这个台暂时播不了，试试下一站。',
  noStations: '没有可播的电台。',
  loadingHint: '首次加载会下载约 1 MB 电台数据。',
  view: '视图',
  globeHint: '拖动旋转 · 滚轮缩放',
  skyHint: '按流派组成的星座 · 点星星收听',
  day: '白天',
  night: '夜晚',
  morning: '早晨',
  evening: '傍晚',
  approxTime: '当地时间（近似）',
  station: '电台',
  stationsCount: '{n} 个电台',
  pressPlay: '按下播放',
  closeSearch: '关闭搜索',
  filter: '筛选',
  clear: '清除',
  selected: '已选择',
  introCredit: '电台目录来自 Radio Browser · 视觉原型示例数据',
  introStats: '{countries} 个国家/地区 · {stations} 个电台',
  theme: '主题',
  themeNight: '夜航',
  keyboardHint: '按 / 搜索',
};

const DICTS: Record<Lang, Dict> = { en, zh };

function detectLang(): Lang {
  try {
    const forced = (window as unknown as { __FM360_LANG__?: unknown }).__FM360_LANG__;
    if (forced === 'zh' || forced === 'en') return forced;
    if (location.pathname === '/en' || location.pathname.startsWith('/en/')) return 'en';
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl === 'zh' || fromUrl === 'en') return fromUrl;
    const stored = localStorage.getItem('fm360.lang');
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    // ignore
  }
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
}

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: keyof Dict, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    applySeo(lang);
    try {
      localStorage.setItem('fm360.lang', lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang: (next: Lang) => {
        setLangState(next);
        try {
          const path = next === 'en' ? '/en/' : '/';
          const url = `${path}${location.search}${location.hash}`;
          if (location.pathname !== path) history.replaceState(null, '', url);
        } catch {
          // ignore
        }
      },
      t: (key, vars) => {
        let text: string = dict[key] ?? en[key] ?? String(key);
        if (vars) {
          for (const [name, val] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(val));
          }
        }
        return text;
      },
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export function regionKey(id: string): keyof Dict {
  switch (id) {
    case 'asia':
      return 'regionAsia';
    case 'europe':
      return 'regionEurope';
    case 'americas':
      return 'regionAmericas';
    case 'africa':
      return 'regionAfrica';
    case 'middleEast':
      return 'regionMiddleEast';
    case 'oceania':
      return 'regionOceania';
    default:
      return 'regionOther';
  }
}

export type { Dict as I18nDict };
