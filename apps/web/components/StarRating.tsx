import { bandVar, starsForBand, type BandName } from "./BandChip";

/** The band's 1–5 rating. Filled stars carry the band colour; the rest are hairline. */
export function StarRating({ band, size = 14 }: { band: BandName; size?: number }) {
  const filled = starsForBand(band);
  return (
    <span
      className="inline-flex gap-0.5"
      role="img"
      aria-label={`${filled} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={n <= filled ? bandVar(band) : "var(--ac-line)"}
          />
        </svg>
      ))}
    </span>
  );
}
