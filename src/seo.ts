import type { Lang } from './i18n';

const ORIGIN = 'https://fm360.toolora.stream';

const COPY = {
  zh: {
    description:
      'fm360 是一个世界电台地图。按晨昏线、流派、国家和地区漫游，随机收听世界各地的电台直播。无需账号，无广告。',
    ogTitle: 'fm360 — 随机一站，听见世界',
    ogDescription:
      '按晨昏线、流派、国家和地区漫游，随机收听世界各地的电台直播。按下播放，目的地交给运气。',
    locale: 'zh_CN',
    alternate: 'en_US',
    imageAlt: 'fm360 — 世界电台地图，随机一站，听见世界',
  },
  en: {
    description:
      'fm360 is a world radio atlas. Browse live radio stations by day/night, genre, country and language. Press play and leave the destination to chance. No account, no ads.',
    ogTitle: 'fm360 — Listen somewhere new',
    ogDescription:
      'A world radio atlas. Roam by day/night, genre, country and language, then press play — the destination is left to chance.',
    locale: 'en_US',
    alternate: 'zh_CN',
    imageAlt: 'fm360 — a world radio atlas. Listen somewhere new.',
  },
} as const;

function meta(selector: string, content: string): void {
  const element = document.querySelector(selector);
  if (element) element.setAttribute('content', content);
}

/**
 * Keep the document head in sync when the user switches language in the app.
 * The static HTML already contains the right tags for crawlers; this is for
 * client-side changes and for share cards generated after a toggle.
 */
export function applySeo(lang: Lang): void {
  const copy = COPY[lang];
  const path = lang === 'en' ? '/en/' : '/';
  const url = `${ORIGIN}${path}`;

  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
  meta('meta[name="description"]', copy.description);
  meta('meta[property="og:title"]', copy.ogTitle);
  meta('meta[property="og:description"]', copy.ogDescription);
  meta('meta[property="og:url"]', url);
  meta('meta[property="og:locale"]', copy.locale);
  meta('meta[property="og:locale:alternate"]', copy.alternate);
  meta('meta[property="og:image:alt"]', copy.imageAlt);
  meta('meta[name="twitter:title"]', copy.ogTitle);
  meta('meta[name="twitter:description"]', copy.ogDescription);
  meta('meta[name="twitter:image:alt"]', copy.imageAlt);
}
