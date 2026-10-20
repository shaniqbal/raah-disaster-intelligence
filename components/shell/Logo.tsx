/** RAAH mark: a route (raah = "path") rising through waypoints to a safe destination. Original artwork. */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="raah-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#0b1528" stroke="url(#raah-mark)" strokeWidth="1.5" />
      <path d="M9 30 C 15 30, 13 20, 20 20 S 25 11, 31 10" fill="none" stroke="url(#raah-mark)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="9" cy="30" r="2.6" fill="#f5a524" />
      <circle cx="20" cy="20" r="2.2" fill="#e7eef8" />
      <path d="M31 5.5c-2.6 0-4.5 2-4.5 4.4 0 3.2 4.5 7.6 4.5 7.6s4.5-4.4 4.5-7.6c0-2.4-1.9-4.4-4.5-4.4z" fill="#2dd4bf" />
      <circle cx="31" cy="9.9" r="1.5" fill="#0b1528" />
    </svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-bold tracking-[0.2em] text-ink">RAAH</span>
          <span className="block pt-0.5 text-[10px] font-medium tracking-wide text-muted">AI Disaster Intelligence</span>
        </span>
      )}
    </span>
  );
}
