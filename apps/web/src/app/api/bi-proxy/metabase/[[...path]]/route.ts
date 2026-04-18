import { NextRequest, NextResponse } from 'next/server';

const METABASE_URL = process.env.METABASE_INTERNAL_URL ?? 'http://metabase:3000';

/**
 * Proxy requests to Metabase, stripping frame-blocking headers
 * (Content-Security-Policy: frame-ancestors 'none' and X-Frame-Options)
 * so Metabase can be embedded in an iframe within ARIS.
 */
// Paths allowed through the proxy (signed embeds + static assets)
const ALLOWED_PREFIXES = ['/embed/', '/app/', '/public/', '/api/util/'];
const ALLOWED_EXTENSIONS = /\.(js|css|map|woff2?|ttf|svg|png|jpg|gif|ico)(\?|$)/i;

async function proxyToMetabase(request: NextRequest, params: { path?: string[] }) {
  const pathSegments = params.path ?? [];
  const metabasePath = '/' + pathSegments.join('/');

  // Security: only allow embed paths and static assets through the proxy.
  // Block direct access to /api/, /question/, /collection/ to prevent
  // bypassing tenant-scoped signed embedding.
  const isAllowed =
    metabasePath === '/' ||
    ALLOWED_PREFIXES.some((p) => metabasePath.startsWith(p)) ||
    ALLOWED_EXTENSIONS.test(metabasePath);

  if (!isAllowed) {
    return NextResponse.json(
      { error: 'Access to this Metabase path is restricted. Use signed embedding.' },
      { status: 403 },
    );
  }

  const url = new URL(metabasePath, METABASE_URL);

  // Forward query string
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  // Forward request headers (pass through cookies, content-type, etc.)
  const headers = new Headers();
  const forwardHeaders = ['content-type', 'accept', 'accept-language', 'cookie', 'x-metabase-session'];
  for (const h of forwardHeaders) {
    const val = request.headers.get(h);
    if (val) headers.set(h, val);
  }

  try {
    const metabaseRes = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.arrayBuffer()
        : undefined,
      redirect: 'manual',
    });

    // Build response, stripping frame-blocking headers
    const responseHeaders = new Headers();

    for (const [key, value] of metabaseRes.headers.entries()) {
      const lower = key.toLowerCase();
      // Skip headers that block iframe embedding or cause encoding issues
      // content-encoding must be stripped because Node.js fetch auto-decompresses
      // the response body, but the header still says gzip → browser double-decompresses
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
        responseHeaders.append(key, value.replace(/path=\//gi, 'path=/api/bi-proxy/metabase/'));
        continue;
      }

      responseHeaders.set(key, value);
    }

    // Handle redirects — rewrite Location header to go through proxy
    const location = metabaseRes.headers.get('location');
    if (location && metabaseRes.status >= 300 && metabaseRes.status < 400) {
      try {
        const locUrl = new URL(location, METABASE_URL);
        if (locUrl.origin === new URL(METABASE_URL).origin) {
          responseHeaders.set('location', `/api/bi-proxy/metabase${locUrl.pathname}${locUrl.search}`);
        }
      } catch {
        if (location.startsWith('/')) {
          responseHeaders.set('location', `/api/bi-proxy/metabase${location}`);
        }
      }
    }

    const body = await metabaseRes.arrayBuffer();

    return new NextResponse(body, {
      status: metabaseRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Metabase proxy error', details: String(err) },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxyToMetabase(request, params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxyToMetabase(request, params);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxyToMetabase(request, params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxyToMetabase(request, params);
}
