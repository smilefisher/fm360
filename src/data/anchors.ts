export interface MapAnchor {
  id: string;
  lat: number;
  lng: number;
  zh: string;
  en: string;
  kind: 'continent' | 'city';
  major?: boolean;
}

/**
 * Labels that make the globe readable at a glance. Continents and major cities
 * are shown at the default zoom; the longer city list appears when zoomed in.
 */
export const MAP_ANCHORS: MapAnchor[] = [
  { id: 'europe', lat: 50, lng: 15, zh: '欧洲', en: 'EUROPE', kind: 'continent' },
  { id: 'africa', lat: 5, lng: 20, zh: '非洲', en: 'AFRICA', kind: 'continent' },
  { id: 'asia', lat: 35, lng: 90, zh: '亚洲', en: 'ASIA', kind: 'continent' },
  { id: 'namerica', lat: 45, lng: -100, zh: '北美洲', en: 'NORTH AMERICA', kind: 'continent' },
  { id: 'samerica', lat: -15, lng: -60, zh: '南美洲', en: 'SOUTH AMERICA', kind: 'continent' },
  { id: 'oceania', lat: -25, lng: 135, zh: '大洋洲', en: 'OCEANIA', kind: 'continent' },

  { id: 'london', lat: 51.5, lng: -0.1, zh: '伦敦', en: 'London', kind: 'city', major: true },
  { id: 'paris', lat: 48.9, lng: 2.35, zh: '巴黎', en: 'Paris', kind: 'city', major: true },
  { id: 'berlin', lat: 52.5, lng: 13.4, zh: '柏林', en: 'Berlin', kind: 'city' },
  { id: 'madrid', lat: 40.4, lng: -3.7, zh: '马德里', en: 'Madrid', kind: 'city' },
  { id: 'rome', lat: 41.9, lng: 12.5, zh: '罗马', en: 'Rome', kind: 'city' },
  { id: 'istanbul', lat: 41, lng: 29, zh: '伊斯坦布尔', en: 'Istanbul', kind: 'city', major: true },
  { id: 'moscow', lat: 55.8, lng: 37.6, zh: '莫斯科', en: 'Moscow', kind: 'city', major: true },
  { id: 'cairo', lat: 30, lng: 31, zh: '开罗', en: 'Cairo', kind: 'city', major: true },
  { id: 'lagos', lat: 6.5, lng: 3.4, zh: '拉各斯', en: 'Lagos', kind: 'city', major: true },
  { id: 'nairobi', lat: -1.3, lng: 36.8, zh: '内罗毕', en: 'Nairobi', kind: 'city' },
  { id: 'joburg', lat: -26.2, lng: 28, zh: '约翰内斯堡', en: 'Johannesburg', kind: 'city', major: true },
  { id: 'dubai', lat: 25.2, lng: 55.3, zh: '迪拜', en: 'Dubai', kind: 'city', major: true },
  { id: 'delhi', lat: 28.6, lng: 77.2, zh: '德里', en: 'Delhi', kind: 'city', major: true },
  { id: 'beijing', lat: 39.9, lng: 116.4, zh: '北京', en: 'Beijing', kind: 'city', major: true },
  { id: 'shanghai', lat: 31.2, lng: 121.5, zh: '上海', en: 'Shanghai', kind: 'city' },
  { id: 'tokyo', lat: 35.7, lng: 139.7, zh: '东京', en: 'Tokyo', kind: 'city', major: true },
  { id: 'seoul', lat: 37.6, lng: 127, zh: '首尔', en: 'Seoul', kind: 'city' },
  { id: 'jakarta', lat: -6.2, lng: 106.8, zh: '雅加达', en: 'Jakarta', kind: 'city' },
  { id: 'singapore', lat: 1.35, lng: 103.8, zh: '新加坡', en: 'Singapore', kind: 'city' },
  { id: 'sydney', lat: -33.9, lng: 151.2, zh: '悉尼', en: 'Sydney', kind: 'city', major: true },
  { id: 'auckland', lat: -36.8, lng: 174.8, zh: '奥克兰', en: 'Auckland', kind: 'city' },
  { id: 'newyork', lat: 40.7, lng: -74, zh: '纽约', en: 'New York', kind: 'city', major: true },
  { id: 'losangeles', lat: 34, lng: -118.2, zh: '洛杉矶', en: 'Los Angeles', kind: 'city', major: true },
  { id: 'chicago', lat: 41.9, lng: -87.6, zh: '芝加哥', en: 'Chicago', kind: 'city' },
  { id: 'toronto', lat: 43.7, lng: -79.4, zh: '多伦多', en: 'Toronto', kind: 'city' },
  { id: 'mexico', lat: 19.4, lng: -99.1, zh: '墨西哥城', en: 'Mexico City', kind: 'city', major: true },
  { id: 'saopaulo', lat: -23.5, lng: -46.6, zh: '圣保罗', en: 'São Paulo', kind: 'city', major: true },
  { id: 'buenosaires', lat: -34.6, lng: -58.4, zh: '布宜诺斯艾利斯', en: 'Buenos Aires', kind: 'city' },
  { id: 'bogota', lat: 4.7, lng: -74.1, zh: '波哥大', en: 'Bogotá', kind: 'city' },
  { id: 'lima', lat: -12, lng: -77, zh: '利马', en: 'Lima', kind: 'city' },
];
