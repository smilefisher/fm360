import { useEffect, useState } from 'react';
import { genreColor, genreLabel } from '../data/genres';
import type { Station } from '../data/types';
import { skyClusterCenters } from '../globe/globeRenderer';
import { useI18n } from '../i18n';

export function SkyLabels({
  stations,
  activeGenres,
}: {
  stations: Station[];
  activeGenres: Set<string>;
}) {
  const { lang } = useI18n();
  const [size, setSize] = useState(() => ({
    w: typeof window === 'undefined' ? 1440 : window.innerWidth,
    h: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const radius = Math.min(size.w, size.h) * 0.42;
  const clusters = skyClusterCenters(stations).filter((cluster) => cluster.count > 0);

  return (
    <div className="sky-labels" aria-hidden="true">
      {clusters.map((cluster) => (
        <span
          key={cluster.genre}
          className={`sky-label ${
            activeGenres.size > 0 && !activeGenres.has(cluster.genre) ? 'dim' : ''
          }`}
          style={{
            left: size.w / 2 + cluster.x * radius,
            top: size.h / 2 - cluster.y * radius,
            ['--sky-color' as string]: genreColor(cluster.genre),
          }}
        >
          <i />
          {genreLabel(cluster.genre, lang)}
          <em>{cluster.count}</em>
        </span>
      ))}
    </div>
  );
}
