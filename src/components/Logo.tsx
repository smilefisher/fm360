export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo" aria-label="fm360">
      <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M32 14v5M32 45v5M14 32h5M45 32h5"
          stroke="var(--accent-2)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M32 32 42 22"
          stroke="var(--accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="32" cy="32" r="2.8" fill="var(--accent)" />
        <circle cx="48" cy="16" r="3.2" fill="var(--coral)" />
      </svg>
      {!compact && <span className="logo-word">fm360</span>}
    </span>
  );
}
