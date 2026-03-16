import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COUNTRIES } from '@/data/countries-config';
import { RECS } from '@/data/recs-config';

/* ── Subdomain lookup sets ─────────────────────────────────────────── */
const COUNTRY_CODES = new Set(Object.keys(COUNTRIES).map((c) => c.toLowerCase()));
const REC_CODES = new Set(Object.keys(RECS)); // already lowercase

const BASE_DOMAINS = ['au-aris.org'];

/**
 * Extract subdomain from Host header.
 *   cm.au-aris.org   → "cm"
 *   igad.au-aris.org → "igad"
 *   au-aris.org / www.au-aris.org / localhost → null
 */
function extractSubdomain(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();

  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  for (const base of BASE_DOMAINS) {
    if (hostname.endsWith(`.${base}`)) {
      const sub = hostname.slice(0, -(base.length + 1));
      if (!sub || sub === 'www') return null;
      return sub;
    }
  }
  return null;
}

/* ── Public route prefixes (no auth required) ──────────────────────── */
const PUBLIC_PREFIXES = [
  '/',           // Continental landing
  '/rec/',       // REC pages
  '/country/',   // Country pages
  '/login',      // Legacy login redirect
  '/register',   // Registration page
  '/forgot-password',
  '/reset-password',
  '/api/',       // API routes
  '/_next/',     // Next.js internals
  '/icons/',     // Static assets
  '/sw.js',
  '/manifest.json',
  '/au-logo.png',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ── Subdomain rewrite (only for root path "/") ──────────────────── */
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  const subdomain = extractSubdomain(host);

  if (subdomain && pathname === '/') {
    let rewritePath: string | null = null;

    if (COUNTRY_CODES.has(subdomain)) {
      // cm.au-aris.org/ → /country/cm  (page uppercases internally)
      rewritePath = `/country/${subdomain}`;
    } else if (REC_CODES.has(subdomain)) {
      // igad.au-aris.org/ → /rec/igad
      rewritePath = `/rec/${subdomain}`;
    }

    if (rewritePath) {
      const url = request.nextUrl.clone();
      url.pathname = rewritePath;
      const response = NextResponse.rewrite(url);
      response.headers.set('x-aris-subdomain', subdomain);
      return response;
    }
  }

  /* ── Public routes pass through ──────────────────────────────────── */
  const isPublic =
    pathname === '/' ||
    PUBLIC_PREFIXES.some((prefix) => prefix !== '/' && pathname.startsWith(prefix));

  if (isPublic) {
    const response = NextResponse.next();
    if (subdomain) response.headers.set('x-aris-subdomain', subdomain);
    return response;
  }

  // For protected routes, let the client-side AuthGuard handle the check.
  // We don't do server-side token validation here since auth state lives
  // in localStorage (client-only Zustand persist).
  const response = NextResponse.next();
  if (subdomain) response.headers.set('x-aris-subdomain', subdomain);
  return response;
}

export const config = {
  // Match all routes except _next/static and _next/image
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
