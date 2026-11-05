/** LL Dance Studio mark: five stars, gold disc with the mirrored-L monogram, wordmark. Vector, so it stays sharp. */
export function Logo({ size = 180, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <svg className="brand" viewBox="-30 0 300 230" width={size} aria-label="LL Dance Studio" role="img">
      <defs>
        <linearGradient id="llg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3dc9a" /><stop offset=".35" stopColor="#c9a24a" /><stop offset=".55" stopColor="#8c6c25" /><stop offset=".8" stopColor="#e6c87a" /><stop offset="1" stopColor="#a8832f" /></linearGradient>
        <linearGradient id="llg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3c4" /><stop offset=".5" stopColor="#e6c87a" /><stop offset="1" stopColor="#b48a35" /></linearGradient>
        <linearGradient id="llsheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <g fill="url(#llg2)">
        <path d="M120 6l3.6 7.6 8.3 1.1-6.1 5.7 1.6 8.2-7.4-4.1-7.4 4.1 1.6-8.2-6.1-5.7 8.3-1.1z" />
        <path d="M93 12l3 6.1 6.7.9-4.9 4.6 1.3 6.6-6.1-3.3-6.1 3.3 1.3-6.6-4.9-4.6 6.7-.9z" />
        <path d="M147 12l3 6.1 6.7.9-4.9 4.6 1.3 6.6-6.1-3.3-6.1 3.3 1.3-6.6-4.9-4.6 6.7-.9z" />
        <path d="M69 24l2.5 5 5.5.8-4 3.8 1 5.4-5-2.7-5 2.7 1-5.4-4-3.8 5.5-.8z" />
        <path d="M171 24l2.5 5 5.5.8-4 3.8 1 5.4-5-2.7-5 2.7 1-5.4-4-3.8 5.5-.8z" />
      </g>
      <circle cx="120" cy="105" r="62" fill="url(#llg1)" /><circle cx="120" cy="105" r="62" fill="url(#llsheen)" />
      <circle cx="120" cy="105" r="58" fill="none" stroke="#fff3c4" strokeOpacity=".35" strokeWidth="1" />
      <g transform="matrix(-1 0 0 1 240 0)"><text x="124" y="129" fontFamily="Cormorant Garamond,Georgia,serif" fontWeight="600" fontSize="72" fill="#0c0b0a">L</text></g>
      <text x="124" y="129" fontFamily="Cormorant Garamond,Georgia,serif" fontWeight="600" fontSize="72" fill="#0c0b0a">L</text>
      <rect x="119" y="72" width="2" height="66" fill="#0c0b0a" />
      {wordmark && <text x="120" y="212" textAnchor="middle" fontFamily="Cormorant Garamond,Georgia,serif" fontWeight="600" fontSize="34" fill="url(#llg2)" letterSpacing="4">DANCE STUDIO</text>}
    </svg>
  );
}
