'use client';

import 'flag-icons/css/flag-icons.min.css';

/**
 * CountryFlag — renders a country flag using flag-icons CSS library.
 *
 * Flags are bundled as SVG in CSS (no external CDN at runtime).
 * Works on ALL browsers including Windows Chrome/Edge.
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
    <span
      className={`fi fi-${lc} ${className ?? ''}`}
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-block',
        verticalAlign: 'middle',
        borderRadius: 2,
        width: size * 1.33,
        height: size,
      }}
      role="img"
      aria-label={code}
    />
  );
}
