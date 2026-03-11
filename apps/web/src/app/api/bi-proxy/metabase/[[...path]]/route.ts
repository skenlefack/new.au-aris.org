import { NextRequest, NextResponse } from 'next/server';

const METABASE_URL = process.env.METABASE_INTERNAL_URL ?? 'http://metabase:3000';

/**
 * Proxy requests to Metabase, stripping frame-blocking headers
 * (Content-Security-Policy: frame-ancestors 'none' and X-Frame-Options)
 * so Metabase can be embedded in an iframe within ARIS.
 */
async function proxyToMetabase(request: NextRequest, params: { path?: string[] }) {
  const pathSegments = params.path ?? [];
  const metabasePath = '/' + pathSegments.join('/');
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
      // Skip headers that block iframe embedding
      if ([
        'transfer-encoding',
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
