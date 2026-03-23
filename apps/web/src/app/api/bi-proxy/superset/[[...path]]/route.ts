import { NextRequest, NextResponse } from 'next/server';

const SUPERSET_URL = process.env.SUPERSET_INTERNAL_URL ?? 'http://superset:8088';

/**
 * Proxy requests to Superset, stripping frame-blocking headers
 * so Superset can be embedded in an iframe / via the Embedded SDK.
 */
async function proxyToSuperset(request: NextRequest, params: { path?: string[] }) {
  const pathSegments = params.path ?? [];
  const supersetPath = '/' + pathSegments.join('/');
  const url = new URL(supersetPath, SUPERSET_URL);

  // Forward query string
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  // Forward request headers
  const headers = new Headers();
  const forwardHeaders = [
    'content-type',
    'accept',
    'accept-language',
    'cookie',
    'authorization',
    'x-guesttoken',
    'x-csrftoken',
  ];
  for (const h of forwardHeaders) {
    const val = request.headers.get(h);
    if (val) headers.set(h, val);
  }

  try {
    const supersetRes = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.arrayBuffer()
        : undefined,
      redirect: 'manual',
    });

    // Build response, stripping frame-blocking headers
    const responseHeaders = new Headers();

    for (const [key, value] of supersetRes.headers.entries()) {
      const lower = key.toLowerCase();
      // Skip headers that block iframe embedding or cause encoding issues
      if ([
        'transfer-encoding',
        'content-encoding',
        'content-length',
        'connection',
        'x-frame-options',
        'content-security-policy',
      ].includes(lower)) continue;

      // Rewrite Set-Cookie paths to match proxy path
      if (lower === 'set-cookie') {
        responseHeaders.append(key, value.replace(/path=\//gi, 'path=/api/bi-proxy/superset/'));
        continue;
      }

      responseHeaders.set(key, value);
    }

    // Handle redirects — rewrite Location header to go through proxy
    const location = supersetRes.headers.get('location');
    if (location && supersetRes.status >= 300 && supersetRes.status < 400) {
      try {
        const locUrl = new URL(location, SUPERSET_URL);
        // Only rewrite internal Superset redirects
        if (locUrl.origin === new URL(SUPERSET_URL).origin) {
          responseHeaders.set('location', `/api/bi-proxy/superset${locUrl.pathname}${locUrl.search}`);
        }
      } catch {
        // If URL parsing fails, leave the Location header as-is
      }
    }

    const body = await supersetRes.arrayBuffer();

    return new NextResponse(body, {
      status: supersetRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Superset proxy error', details: String(err) },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxyToSuperset(request, params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxyToSuperset(request, params);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxyToSuperset(request, params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxyToSuperset(request, params);
}
