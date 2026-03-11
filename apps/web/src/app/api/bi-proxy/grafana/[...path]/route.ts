import { NextRequest, NextResponse } from 'next/server';

const GRAFANA_URL = process.env.GRAFANA_INTERNAL_URL ?? 'http://grafana:3000';

/** Map ARIS roles to Grafana org roles */
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

/** Decode JWT payload without verification (auth already validated upstream) */
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

function extractUser(request: NextRequest) {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const decoded = decodeJwtPayload(authHeader.slice(7));
    if (decoded) return decoded;
  }

  // Try cookie (aris-auth stores JSON with accessToken)
  const cookie = request.cookies.get('aris-auth');
  if (cookie?.value) {
    try {
      const parsed = JSON.parse(cookie.value);
      const token = parsed?.state?.accessToken;
      if (token) return decodeJwtPayload(token);
    } catch { /* ignore */ }
  }

  return null;
}

async function proxyToGrafana(request: NextRequest, params: { path: string[] }) {
  const user = extractUser(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pathSegments = params.path ?? [];
  const grafanaPath = '/' + pathSegments.join('/');
  const url = new URL(grafanaPath, GRAFANA_URL);

  // Forward query string
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  // Build headers for Grafana auth proxy
  const headers = new Headers();
  headers.set('X-WEBAUTH-USER', user.email ?? 'unknown@aris.org');
  headers.set('X-WEBAUTH-NAME', `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'ARIS User');
  headers.set('X-WEBAUTH-ROLE', ROLE_MAP[user.role] ?? 'Viewer');

  // Forward relevant request headers
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);

  try {
    const grafanaRes = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.arrayBuffer()
        : undefined,
      redirect: 'manual',
    });

    // Build response
    const responseHeaders = new Headers();

    // Forward relevant Grafana response headers
    for (const [key, value] of grafanaRes.headers.entries()) {
      const lower = key.toLowerCase();
      // Skip hop-by-hop and framing headers
      if (['transfer-encoding', 'connection', 'x-frame-options', 'content-security-policy'].includes(lower)) continue;
      responseHeaders.set(key, value);
    }

    const body = await grafanaRes.arrayBuffer();

    return new NextResponse(body, {
      status: grafanaRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Grafana proxy error', details: String(err) },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return proxyToGrafana(request, params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return proxyToGrafana(request, params);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return proxyToGrafana(request, params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return proxyToGrafana(request, params);
}
