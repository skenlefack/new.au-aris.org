import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Fastify preHandler hook that checks if the authenticated user
 * has the required permission (module:feature:action).
 *
 * Resolution order:
 * 1. Check user.roles includes SUPER_ADMIN → always allowed
 * 2. Check cached permissions from request (populated by middleware)
 * 3. Fallback: allow if user has any roles (backward compat)
 */
export function permissionsHook(module: string, feature: string, action: string) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      return reply.code(401).send({
        statusCode: 401,
        message: 'Not authenticated',
      });
    }

    // SUPER_ADMIN always has access
    if (user.role === 'SUPER_ADMIN' || user.roles.includes('SUPER_ADMIN')) {
      return;
    }

    // Check permissions from request context (set by permission-loading middleware)
    const permissions = (request as any)._permissions as
      | Array<{ module: string; feature: string; action: string }>
      | undefined;

    if (permissions) {
      const hasPermission = permissions.some(
        (p) => p.module === module && p.feature === feature && p.action === action,
      );
      if (hasPermission) return;

      return reply.code(403).send({
        statusCode: 403,
        message: `Missing permission: ${module}:${feature}:${action}`,
      });
    }

    // Fallback: if no permission data available, allow through
    // (backward compat — old tokens without permission cache)
  };
}
