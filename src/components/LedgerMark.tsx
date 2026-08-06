/**
 * Simplified app mark for small sizes.
 *
 * The full app icon (a stitched wallet with banknotes and a pencil) turns to mush
 * below ~48px, so the sidebar and header use this reduced form instead: the same
 * orange tile and cream "$", drawn as vectors so it stays crisp at 28px.
 * Colours are sampled from the icon artwork.
 */
export default function LedgerMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="LEDGER"
    >
      <defs>
        <linearGradient id="ledger-mark-face" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB43A" />
          <stop offset="1" stopColor="#FF9111" />
        </linearGradient>
      </defs>

      {/* tile, with the deep-red edge from the icon as a rim */}
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#CB3100" />
      <rect x="2.5" y="2.5" width="27" height="27" rx="6.75" fill="url(#ledger-mark-face)" />

      {/* $ — heavier strokes than a text glyph so it survives at 28px */}
      <path
        d="M16 6.6v2.0M16 23.4v-2.0"
        stroke="#FFFDEE"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M20.2 11.4c0-1.9-1.9-3.2-4.2-3.2s-4.2 1.3-4.2 3.2c0 4.6 8.4 1.8 8.4 6.4 0 2.1-1.9 3.4-4.2 3.4s-4.2-1.3-4.2-3.4"
        stroke="#FFFDEE"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
