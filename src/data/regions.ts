import type { Station } from './types';

export type RegionId =
  | 'americas'
  | 'europe'
  | 'africa'
  | 'middleEast'
  | 'asia'
  | 'oceania'
  | 'other';

export type RegionPref = 'auto' | 'all' | RegionId;

export const REGIONS: Array<{ id: RegionId; zh: string; en: string }> = [
  { id: 'asia', zh: '亚洲', en: 'Asia' },
  { id: 'europe', zh: '欧洲', en: 'Europe' },
  { id: 'americas', zh: '美洲', en: 'Americas' },
  { id: 'africa', zh: '非洲', en: 'Africa' },
  { id: 'middleEast', zh: '中东', en: 'Middle East' },
  { id: 'oceania', zh: '大洋洲', en: 'Oceania' },
  { id: 'other', zh: '其他', en: 'Other' },
];

const EUROPE = new Set([
  'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK',
  'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE',
  'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK',
  'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM',
  'UA', 'VA', 'XK',
]);

const AMERICAS = new Set([
  'US', 'CA', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'DO',
  'HT', 'JM', 'PR', 'TT', 'BB', 'BS', 'AG', 'DM', 'GD', 'KN', 'LC', 'VC',
  'AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE',
  'FK', 'GF', 'GP', 'MQ',
]);

const AFRICA = new Set([
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD', 'KM', 'CG',
  'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN',
  'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ',
  'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD',
  'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW', 'EH', 'RE', 'YT',
]);

const MIDDLE_EAST = new Set([
  'AE', 'AM', 'AZ', 'BH', 'GE', 'IL', 'IQ', 'IR', 'JO', 'KW', 'LB', 'OM',
  'PS', 'QA', 'SA', 'SY', 'TR', 'YE',
]);

const ASIA = new Set([
  'AF', 'BD', 'BT', 'BN', 'KH', 'CN', 'HK', 'IN', 'ID', 'JP', 'KZ', 'KG',
  'LA', 'MO', 'MY', 'MV', 'MN', 'MM', 'NP', 'KP', 'PK', 'PH', 'SG', 'KR',
  'LK', 'TW', 'TJ', 'TH', 'TL', 'TM', 'UZ', 'VN',
]);

const OCEANIA = new Set([
  'AU', 'NZ', 'FJ', 'PG', 'SB', 'VU', 'WS', 'TO', 'KI', 'NC', 'PF', 'GU',
  'AS', 'MP', 'FM', 'MH', 'PW', 'NU', 'CK', 'TV', 'NR',
]);

export function regionOfCountry(cc: string): RegionId {
  const code = cc.toUpperCase();
  if (EUROPE.has(code)) return 'europe';
  if (AMERICAS.has(code)) return 'americas';
  if (AFRICA.has(code)) return 'africa';
  if (MIDDLE_EAST.has(code)) return 'middleEast';
  if (ASIA.has(code)) return 'asia';
  if (OCEANIA.has(code)) return 'oceania';
  return 'other';
}

export function regionOfStation(station: Station): RegionId {
  return regionOfCountry(station.cc);
}

export function regionFromTimezone(tz: string): RegionId {
  if (tz.startsWith('Europe/')) return 'europe';
  if (tz.startsWith('America/')) return 'americas';
  if (tz.startsWith('Africa/')) return 'africa';
  if (tz.startsWith('Australia/') || tz.startsWith('Pacific/')) return 'oceania';
  if (tz.startsWith('Asia/')) return 'asia';
  if (tz.startsWith('Indian/')) return 'africa';
  return 'other';
}

export function detectedRegion(): RegionId {
  try {
    return regionFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return 'other';
  }
}

export function regionLabel(id: RegionId, lang: 'zh' | 'en'): string {
  return REGIONS.find((r) => r.id === id)?.[lang] ?? (lang === 'zh' ? '其他' : 'Other');
}
