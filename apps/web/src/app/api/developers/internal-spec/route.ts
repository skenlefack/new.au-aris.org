import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Full (internal) ARIS Interoperability API reference.
 *
 * Served only to signed-in Super Admins and Continental Admins. The token is
 * checked by the credential service (signature, expiry, revoked session), and
 * the role comes from its answer, never from the token payload alone.
 *
 * The public partner reference stays at /developers (public/developers).
 */

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN']);
const SPEC_FILE = path.join(process.cwd(), 'private', 'openapi', 'aris-interop.internal.yaml');

function credentialBaseUrl(): string {
  if (process.env.INTERNAL_CREDENTIAL_URL) return process.env.INTERNAL_CREDENTIAL_URL;
  // Same Docker network as the tenant service: aris-tenant → aris-credential,
  // aris-stg-tenant → aris-stg-credential.
  const tenant = process.env.INTERNAL_TENANT_URL;
  if (tenant && tenant.includes('tenant:3001')) return tenant.replace('tenant:3001', 'credential:3002');
  return process.env.SERVICE_CREDENTIAL_URL || 'http://localhost:3002';
}

let specCache: string | null = null;

function reply(status: number, message: string) {
  return NextResponse.json(
    { statusCode: status, message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(auth)) return reply(401, 'Sign in to ARIS to view this page.');

  let role: string | undefined;
  let active = false;
  try {
    const res = await fetch(`${credentialBaseUrl()}/api/v1/credential/users/me`, {
      headers: { Authorization: auth },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) {
      return reply(401, 'Your ARIS session has expired. Sign in again.');
    }
    if (!res.ok) return reply(502, 'Could not check your access. Try again later.');
    const body = (await res.json()) as { data?: { role?: string; isActive?: boolean } };
    role = body.data?.role;
    active = body.data?.isActive !== false;
  } catch {
    return reply(502, 'Could not check your access. Try again later.');
  }

  if (!active || !role || !ALLOWED_ROLES.has(role)) {
    return reply(403, 'This page is restricted to Super Administrators and Continental Administrators.');
  }

  try {
    specCache ??= await readFile(SPEC_FILE, 'utf8');
  } catch {
    return reply(500, 'The API reference is not available on this server.');
  }

  return new NextResponse(specCache, {
    status: 200,
    headers: {
      'Content-Type': 'application/yaml; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
