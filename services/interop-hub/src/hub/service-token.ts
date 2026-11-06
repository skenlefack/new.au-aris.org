/**
 * Short-lived service token used when the hub calls another ARIS service
 * on behalf of a pipeline (e.g. loading inbound records into collecte).
 *
 * The token is issued for the user who owns the pipeline, with that user's
 * real role and tenant, so the target service applies its normal RBAC and
 * the audit trail shows who configured the flow.
 */
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const TOKEN_TTL_SECONDS = 3600; // covers loading of the largest batches

interface UserLookup {
  user: {
    findUnique(args: {
      where: { id: string };
      include: { tenant: true };
    }): Promise<{
      id: string;
      email: string;
      role: string;
      tenantId: string;
      tenant?: { level?: string } | null;
    } | null>;
  };
}

let cachedKey: string | null = null;

function privateKey(): string {
  if (cachedKey) return cachedKey;
  const inline = process.env['JWT_PRIVATE_KEY'];
  if (inline) {
    cachedKey = inline.replace(/\\n/g, '\n');
    return cachedKey;
  }
  const path = process.env['JWT_PRIVATE_KEY_PATH'] ?? '/app/keys/private.pem';
  cachedKey = readFileSync(path, 'utf-8');
  return cachedKey;
}

/** For tests only. */
export function setServiceTokenKeyForTests(key: string | null): void {
  cachedKey = key;
}

export async function issueServiceToken(prisma: UserLookup, userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { tenant: true } });
  if (!user) {
    throw new Error(`Pipeline owner ${userId} not found — cannot authenticate to ARIS services`);
  }
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      roles: [user.role],
      tenantId: user.tenantId,
      tenantLevel: user.tenant?.level,
      svc: 'interop-hub',
    },
    privateKey(),
    { algorithm: 'RS256', expiresIn: TOKEN_TTL_SECONDS },
  );
}
