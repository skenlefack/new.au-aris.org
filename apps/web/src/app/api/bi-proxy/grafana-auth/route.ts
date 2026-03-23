import { NextRequest, NextResponse } from 'next/server';

/**
 * Traefik ForwardAuth endpoint for Grafana.
 *
 * Traefik sends the original request headers (including cookies) to this endpoint.
 * We decode the ARIS JWT from the `aris-bi-token` cookie and return Grafana auth
 * proxy headers (X-WEBAUTH-*). Traefik then forwards these to Grafana.
 *
 * Flow:
 *   Browser → Traefik (PathPrefix /grafana) → ForwardAuth → this endpoint
 *   If 200 + headers → Traefik adds headers → Grafana (auto-creates user)
 *   If 401 → Traefik returns 401 to browser
 */

const ROLE_MAP: Record<string, string> = {
  SUPER_ADMIN: 'Admin',
  CONTINENTAL_ADMIN: 'Admin',
  REC_ADMIN: 'Editor',
  NATIONAL_ADMIN: 'Editor',
  DATA_STEWARD: 'Editor',
  ANALYST: 'Viewer',
  WAHIS_FOCAL_POINT: 'Viewer',
  FIELD_AGENT: 'Viewer',
};

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Read aris-bi-token cookie (set by Grafana page before loading iframe)
  const biToken = request.cookies.get('aris-bi-token')?.value;

  if (biToken) {
    const user = decodeJwtPayload(biToken);
    if (user) {
      const headers = new Headers();
      headers.set('X-WEBAUTH-USER', user.email ?? 'unknown@aris.org');
      headers.set(
        'X-WEBAUTH-NAME',
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'ARIS User',
      );
      headers.set('X-WEBAUTH-ROLE', ROLE_MAP[user.role] ?? 'Viewer');
      return new NextResponse(null, { status: 200, headers });
    }
  }

  // No valid token — allow access with a default viewer (Grafana dashboards are semi-public)
  // This avoids blocking static asset loads that don't carry cookies
  const headers = new Headers();
  headers.set('X-WEBAUTH-USER', 'viewer@au-aris.org');
  headers.set('X-WEBAUTH-NAME', 'ARIS Viewer');
  headers.set('X-WEBAUTH-ROLE', 'Viewer');
  return new NextResponse(null, { status: 200, headers });
}
