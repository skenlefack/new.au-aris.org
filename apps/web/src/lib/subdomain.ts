import { COUNTRIES } from '@/data/countries-config';
import { RECS } from '@/data/recs-config';

const COUNTRY_CODES = new Set(Object.keys(COUNTRIES).map((c) => c.toLowerCase()));
const REC_CODES = new Set(Object.keys(RECS));

const BASE_DOMAINS = ['au-aris.org'];

/**
 * Extract the subdomain from a hostname.
 * Returns `null` for bare domain, www, localhost, or staging continental ("test").
 *
 * Examples:
 *   cm.au-aris.org        → "cm"
 *   igad.au-aris.org      → "igad"
 *   cm-test.au-aris.org   → "cm"   (staging country)
 *   igad-test.au-aris.org → "igad" (staging REC)
 *   test.au-aris.org      → null   (staging continental)
 *   au-aris.org           → null
 *   www.au-aris.org       → null
 *   localhost:3000        → null
 */
export function extractSubdomain(host: string | null): string | null {
  if (!host) return null;

  // Strip port
  const hostname = host.split(':')[0].toLowerCase();

  // localhost or IP → no subdomain
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  for (const base of BASE_DOMAINS) {
    if (hostname.endsWith(`.${base}`)) {
      let sub = hostname.slice(0, -(base.length + 1)); // remove ".au-aris.org"
      if (!sub || sub === 'www' || sub === 'www-test') return null;

      // Staging subdomain: strip "-test" suffix to get the real code
      // e.g. "cm-test" → "cm", "igad-test" → "igad"
      // "test" alone = staging continental (no subdomain)
      if (sub === 'test') return null;
      if (sub.endsWith('-test')) {
        sub = sub.slice(0, -5); // remove "-test"
      }

      return sub;
    }
  }

  return null;
}

/** Client-side helper: get the current subdomain from window.location */
export function getSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  return extractSubdomain(window.location.host);
}

/** Check if a subdomain corresponds to a country code */
export function isCountrySubdomain(sub: string): boolean {
  return COUNTRY_CODES.has(sub.toLowerCase());
}

/** Check if a subdomain corresponds to a REC code */
export function isRecSubdomain(sub: string): boolean {
  return REC_CODES.has(sub.toLowerCase());
}
