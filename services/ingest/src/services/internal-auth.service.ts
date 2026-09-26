import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';

const JWT_PRIVATE_KEY_PATH = process.env['JWT_PRIVATE_KEY_PATH'] ?? '';
const JWT_ALGORITHM = 'RS256';
const SERVICE_ISSUER = 'aris-ingest-service';

let privateKey: string | null = null;

function getPrivateKey(): string | null {
  if (privateKey) return privateKey;
  if (!JWT_PRIVATE_KEY_PATH) return null;
  try {
    privateKey = fs.readFileSync(JWT_PRIVATE_KEY_PATH, 'utf8');
    return privateKey;
  } catch {
    return null;
  }
}

/**
 * Generate a short-lived internal service token for calling Collecte sync API.
 * This token impersonates the uploading user with their tenant context,
 * allowing Collecte to verify the submission rights normally.
 */
export function generateServiceToken(
  userId: string,
  tenantId: string,
  tenantLevel: string,
  role: string,
  domains: Record<string, string[]>,
): string | null {
  const key = getPrivateKey();
  if (!key) return null;

  const payload = {
    sub: userId,
    email: `ingest-service@internal`,
    role,
    roles: [role],
    tenantId,
    tenantLevel,
    domains,
    iss: SERVICE_ISSUER,
    aud: 'aris-collecte-service',
  };

  return jwt.sign(payload, key, {
    algorithm: JWT_ALGORITHM as jwt.Algorithm,
    expiresIn: '5m', // Short-lived — only for the batch duration
  });
}

/**
 * Build Authorization headers for internal service calls.
 * Falls back to X-Internal-Service header if JWT signing is unavailable.
 */
export function getInternalAuthHeaders(
  userId: string,
  tenantId: string,
  tenantLevel: string,
  role: string,
  domains: Record<string, string[]>,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Id': tenantId,
  };

  const token = generateServiceToken(userId, tenantId, tenantLevel, role, domains);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Fallback: internal service header (less secure, for dev/staging)
    headers['X-Internal-Service'] = 'ingest-service';
  }

  return headers;
}
