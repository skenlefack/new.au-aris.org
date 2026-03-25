import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Returns a Fastify preHandler that checks if the authenticated user
 * has at least one of the required domain codes assigned.
 * SUPER_ADMIN bypasses the check.
 */
export function domainsHook(...requiredDomains: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      return reply.code(403).send({
        statusCode: 403,
        message: 'User not authenticated',
      });
    }

    // SUPER_ADMIN bypasses domain restrictions
    if (user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (requiredDomains.length === 0) {
      return;
    }

    const userDomains = user.domains ?? [];
    const hasAccess = requiredDomains.some((d) => userDomains.includes(d));

    if (!hasAccess) {
      return reply.code(403).send({
        statusCode: 403,
        message: `Access denied. Required domain: ${requiredDomains.join(' or ')}`,
      });
    }
  };
}
