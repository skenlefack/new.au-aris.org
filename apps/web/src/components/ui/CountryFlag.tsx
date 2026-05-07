'use client';

/**
 * CountryFlag — renders a country flag as an image (CDN-backed).
 *
 * Windows Chrome/Edge do not render Unicode flag emoji.
 * This component uses flagcdn.com PNG images with the ISO alpha-2 code.
 *
 * Usage: <CountryFlag code="KE" size={24} />
 */

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 country code (e.g. "KE", "NG") */
  code: string;
  /** Size in pixels (default 20) */
  size?: number;
  /** Additional class names */
  className?: string;
}

export function CountryFlag({ code, size = 20, className }: CountryFlagProps) {
  if (!code) return null;
  const lc = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w${Math.min(Math.ceil(size * 2), 160)}/${lc}.png`}
      srcSet={`https://flagcdn.com/w${Math.min(Math.ceil(size * 3), 320)}/${lc}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={code}
      className={className}
      loading="lazy"
      style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: 2 }}
    />
  );
}
