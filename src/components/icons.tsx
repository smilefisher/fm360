import type { SVGProps } from 'react';

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

export function IconPlay(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M8 5.4v13.2L18.6 12 8 5.4z" />
    </svg>
  );
}

export function IconPause(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <rect x="7" y="5.5" width="3.4" height="13" rx="1.2" />
      <rect x="13.6" y="5.5" width="3.4" height="13" rx="1.2" />
    </svg>
  );
}

export function IconNext(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M6 5.7v12.6L15.4 12 6 5.7z" />
      <rect x="16.2" y="5.7" width="2.6" height="12.6" rx="1" />
    </svg>
  );
}

export function IconPrevious(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M18 5.7v12.6L8.6 12 18 5.7z" />
      <rect x="5.2" y="5.7" width="2.6" height="12.6" rx="1" />
    </svg>
  );
}

export function IconHeart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 20s-7.2-4.4-7.2-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7.2 2.7C19.2 15.6 12 20 12 20z" />
    </svg>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10.7" cy="10.7" r="6.4" />
      <path d="m15.5 15.5 4.2 4.2" />
    </svg>
  );
}

export function IconGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.9 12h16.2M12 3.8c2.4 2.4 3.6 5.2 3.6 8.2S14.4 17.8 12 20.2C9.6 17.8 8.4 15 8.4 12S9.6 6.2 12 3.8z" />
    </svg>
  );
}

export function IconSky(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m12 3.8 1.25 3.45L16.7 8.5l-3.45 1.25L12 13.2l-1.25-3.45L7.3 8.5l3.45-1.25L12 3.8z" />
      <path d="m6.2 14.4.75 2.05L9 17.2l-2.05.75L6.2 20l-.75-2.05L3.4 17.2l2.05-.75.75-2.05z" />
      <path d="m17.6 14.2.6 1.65 1.65.6-1.65.6-.6 1.65-.6-1.65-1.65-.6 1.65-.6.6-1.65z" />
    </svg>
  );
}

export function IconVolume(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 9.5v5h3l4 3.2V6.3l-4 3.2h-3z" />
      <path d="M15.2 9a4.4 4.4 0 0 1 0 6M17.8 6.6a7.7 7.7 0 0 1 0 10.8" />
    </svg>
  );
}

export function IconVolumeOff(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 9.5v5h3l4 3.2V6.3l-4 3.2h-3z" />
      <path d="m16 9.5 4 5M20 9.5l-4 5" />
    </svg>
  );
}

export function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M19.3 14.2A7.6 7.6 0 0 1 9.8 4.7 7.7 7.7 0 1 0 19.3 14.2z" />
    </svg>
  );
}

export function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
    </svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconShare(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 15V4.5M8.4 8.1 12 4.5l3.6 3.6" />
      <path d="M5.5 13.5v5.2c0 .7.6 1.3 1.3 1.3h10.4c.7 0 1.3-.6 1.3-1.3v-5.2" />
    </svg>
  );
}

export function IconChevron(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m6.5 9.5 5.5 5 5.5-5" />
    </svg>
  );
}

export function IconSignal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <rect x="4.5" y="13" width="2.4" height="6" rx="1" />
      <rect x="9" y="10" width="2.4" height="9" rx="1" />
      <rect x="13.5" y="7" width="2.4" height="12" rx="1" />
      <rect x="18" y="4.5" width="2.4" height="14.5" rx="1" opacity="0.45" />
    </svg>
  );
}

export function IconList(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
    </svg>
  );
}
