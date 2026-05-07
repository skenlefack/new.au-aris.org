'use client';

import { useState } from 'react';

/**
 * CountryFlag — renders a country flag with image fallback to emoji.
 *
 * Tries multiple CDN sources, falls back to emoji if all fail.
 * Works on all browsers including Windows Chrome/Edge.
 */

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 country code (e.g. "KE", "NG") */
  code: string;
  /** Emoji flag (optional, used as fallback) */
  emoji?: string;
  /** Size in pixels (default 20) */
  size?: number;
  /** Additional class names */
  className?: string;
}

/** Convert ISO alpha-2 code to emoji flag */
function codeToEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

export function CountryFlag({ code, emoji, size = 20, className }: CountryFlagProps) {
  if (!code) return null;
  const [imgFailed, setImgFailed] = useState(false);
  const lc = code.toLowerCase();
  const flag = emoji || codeToEmoji(code);

  if (imgFailed) {
    // Fallback to emoji (works on Firefox, macOS, Linux, mobile)
    return (
      <span
        className={className}
        style={{ fontSize: size * 0.8, lineHeight: 1, display: 'inline-block', verticalAlign: 'middle' }}
        role="img"
        aria-label={code}
      >
        {flag}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w${Math.min(Math.ceil(size * 2), 160)}/${lc}.png`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={code}
      className={className}
      loading="lazy"
      onError={() => setImgFailed(true)}
      style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: 2 }}
    />
  );
}
