import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Public routes that do NOT require authentication.
 * These are the new landing pages + auth pages + static assets.
 */
const PUBLIC_PREFIXES = [
  '/',           // Continental landing
  '/rec/',       // REC pages
  '/country/',   // Country pages
  '/login',      // Legacy login redirect
  '/register',   // Registration page
  '/forgot-password',
  '/api/',       // API routes
  '/_next/',     // Next.js internals
  '/icons/',     // Static assets
  '/sw.js',
  '/manifest.json',
  '/au-logo.png',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public routes through
  const isPublic =
    pathname === '/' ||
    PUBLIC_PREFIXES.some((prefix) => prefix !== '/' && pathname.startsWith(prefix));

  if (isPublic) {
    return NextResponse.next();
  }

  // For protected routes, let the client-side AuthGuard handle the check.
  // We don't do server-side token validation here since auth state lives
  // in localStorage (client-only Zustand persist).
  return NextResponse.next();
}

export const config = {
  // Match all routes except _next/static and _next/image
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
